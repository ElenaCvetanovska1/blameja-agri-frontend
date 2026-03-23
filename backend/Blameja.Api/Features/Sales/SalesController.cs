using Blameja.Api.Features.Sales.Dtos;
using Blameja.Api.Infrastructure.Database;
using Blameja.Api.Middleware;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.Sales;

/// <summary>
/// POS sales: product search, exact lookup, sale submission, fiscal result update.
/// Replaces all direct Supabase calls from:
///   useProductSearch.ts, sales/page.tsx (fetchProductFromStockByExactCode),
///   useSalesSubmit.ts, useFiscalSaleFlow.ts (saveFiscalResult)
/// </summary>
[ApiController]
[Route("api/sales")]
[Authorize]
public sealed class SalesController(DbConnectionFactory db) : ControllerBase
{
    // ── GET /api/sales/products/search ─────────────────────────────────────
    /// <summary>
    /// Fuzzy product search for the POS code input.
    /// Mirrors the dual-query logic of useProductSearch.ts:
    ///   - ILIKE match on barcode/name/plu (base results)
    ///   - Exact PLU match merged in (for pure-digit inputs)
    /// Replaces useProductSearch.ts
    /// </summary>
    [HttpGet("products/search")]
    public async Task<IActionResult> SearchProducts(
        [FromQuery] string q,
        [FromQuery] int    storeNo,
        [FromQuery] int    limit = 8,
        CancellationToken  ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<ProductStockDto>());

        // If the query is all-digits, also attempt an exact PLU match
        var pluExact = q.Trim() is { } t && t.Length > 0 && t.All(char.IsDigit) ? t : null;

        const string sql = """
            SELECT DISTINCT ON (product_id)
                product_id,
                plu,
                barcode,
                name,
                selling_price,
                qty_on_hand,
                category_name,
                store_no,
                tax_group,
                is_macedonian
            FROM product_stock
            WHERE store_no = @storeNo
              AND (
                    barcode ILIKE '%' || @q || '%'
                 OR name    ILIKE '%' || @q || '%'
                 OR plu     ILIKE '%' || @q || '%'
                 OR (@pluExact IS NOT NULL AND plu = @pluExact)
              )
            ORDER BY product_id, qty_on_hand DESC NULLS LAST
            LIMIT @limit;
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<ProductStockDto>(sql, new { q = q.Trim(), storeNo, pluExact, limit });

        // Re-sort by qty_on_hand descending (mirrors frontend deduplication sort)
        var sorted = rows.OrderByDescending(r => r.QtyOnHand).Take(limit);
        return Ok(sorted);
    }

    // ── GET /api/sales/products/lookup ─────────────────────────────────────
    /// <summary>
    /// Exact product lookup by barcode or PLU for scanner input / Enter key.
    /// Replaces fetchProductFromStockByExactCode() in sales/page.tsx
    /// </summary>
    [HttpGet("products/lookup")]
    public async Task<IActionResult> LookupProduct(
        [FromQuery] string code,
        [FromQuery] int    storeNo,
        CancellationToken  ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Ok((ProductStockDto?)null);

        var trimmed  = code.Trim();
        var pluExact = trimmed.All(char.IsDigit) ? trimmed : null;

        const string sql = """
            SELECT
                product_id,
                plu,
                barcode,
                name,
                selling_price,
                qty_on_hand,
                category_name,
                store_no,
                tax_group,
                is_macedonian
            FROM product_stock
            WHERE store_no = @storeNo
              AND (
                    barcode = @trimmed
                 OR (@pluExact IS NOT NULL AND plu = @pluExact)
              )
            LIMIT 1;
            """;

        using var conn = db.CreateConnection();
        var product = await conn.QuerySingleOrDefaultAsync<ProductStockDto>(
            sql, new { trimmed, storeNo, pluExact });

        return Ok(product);  // null → frontend shows "not found"
    }

    // ── POST /api/sales ────────────────────────────────────────────────────
    /// <summary>
    /// Submit a complete POS sale.
    /// Performs the 4-table write sequence that previously ran on the frontend
    /// (sales_receipts → sales_items → stock_movements → stock_movement_items).
    /// Also performs the stock-level warning check (non-blocking, like the frontend).
    /// Replaces useSalesSubmit.ts
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SubmitSale(
        [FromBody] SubmitSaleRequest request,
        CancellationToken ct)
    {
        // ── Business validation ────────────────────────────────────────────
        if (request.Items is null || request.Items.Count == 0)
            throw new ApiException("Кошничката е празна.");

        if (request.Total <= 0)
            throw new ApiException("Вкупниот износ мора да биде > 0.");

        if (request.Payment == "CASH")
        {
            var cash = request.CashReceived ?? 0;
            if (cash < request.Total)
                throw new ApiException(
                    $"Недоволно готово. Вкупно: {request.Total:F2} / Дава: {cash:F2}.");
        }

        using var conn = db.CreateConnection();

        // ── Stock level check (warning only — sale is allowed to go negative) ─
        var stockWarnings = new List<string>();
        foreach (var item in request.Items)
        {
            var available = await conn.ExecuteScalarAsync<decimal?>(
                "SELECT qty_on_hand FROM product_stock WHERE product_id = @pid LIMIT 1;",
                new { pid = item.ProductId });

            var qty = available ?? 0;
            if (qty < item.Qty)
                stockWarnings.Add($"{item.ProductId}: достапно {qty}, бараш {item.Qty}");
        }

        // ── 1. Insert sales_receipts ───────────────────────────────────────
        if (request.Items is null || request.Items.Count == 0)
            throw new ApiException("Кошничката е празна.");

        if (request.Total <= 0)
            throw new ApiException("Вкупниот износ мора да биде > 0.");

        if (request.Payment is not ("CASH" or "CARD"))
            throw new ApiException("Невалиден начин на плаќање.");

        if (request.Payment == "CASH")
        {
            var cash = request.CashReceived ?? 0;
            if (cash < request.Total)
                throw new ApiException(
                    $"Недоволно готово. Вкупно: {request.Total:F2} / Дава: {cash:F2}.");
        }

        const string receiptSql = """
            INSERT INTO sales_receipts (payment, total, cash_received)
            VALUES (@payment::payment_method, @total, @cashReceived)
            RETURNING id, receipt_no;
            """;

        var receipt = await conn.QuerySingleAsync<(Guid Id, int ReceiptNo)>(receiptSql, new
        {
            payment      = request.Payment,
            total        = request.Total,
            cashReceived = request.CashReceived,
        });

        // ── 2. Insert sales_items (bulk) ───────────────────────────────────
        const string itemSql = """
            INSERT INTO sales_items (receipt_id, product_id, qty, base_price, price, discount)
            VALUES (@receiptId, @productId, @qty, @basePrice, @price, @discount);
            """;

        foreach (var item in request.Items)
        {
            await conn.ExecuteAsync(itemSql, new
            {
                receiptId = receipt.Id,
                item.ProductId,
                item.Qty,
                item.BasePrice,
                item.Price,
                item.Discount,
            });
        }

        // ── 3. Insert stock_movements (OUT) ────────────────────────────────
        var note = !string.IsNullOrWhiteSpace(request.Note)
            ? request.Note.Trim()
            : $"Internal sale #{receipt.ReceiptNo} ({(request.Payment == "CASH" ? "Cash" : "Card")})";

        const string movSql = """
            INSERT INTO stock_movements (type, note)
            VALUES ('OUT', @note)
            RETURNING id;
            """;

        var movementId = await conn.ExecuteScalarAsync<Guid>(movSql, new { note });

        // ── 4. Insert stock_movement_items (bulk) ──────────────────────────
        const string movItemSql = """
            INSERT INTO stock_movement_items (movement_id, product_id, qty, unit_cost, unit_price)
            VALUES (@movementId, @productId, @qty, 0, @unitPrice);
            """;

        foreach (var item in request.Items)
        {
            await conn.ExecuteAsync(movItemSql, new
            {
                movementId,
                item.ProductId,
                item.Qty,
                unitPrice = item.Price,
            });
        }

        var dto = new SaleReceiptDto
        {
            Id           = receipt.Id,
            ReceiptNo    = receipt.ReceiptNo,
            Payment      = request.Payment,
            Total        = request.Total,
            CashReceived = request.CashReceived,
            CreatedAt    = DateTime.UtcNow,
        };

        return Created($"/api/sales/{receipt.Id}", new
        {
            receipt        = dto,
            stock_warnings = stockWarnings,
        });
    }

    // ── PATCH /api/sales/{id}/fiscal ───────────────────────────────────────
    /// <summary>
    /// Update fiscal device result on a sales_receipts row.
    /// Called by the frontend after the fiscal device interaction completes.
    /// Replaces saveFiscalResult() in useFiscalSaleFlow.ts
    /// </summary>
    [HttpPatch("{receiptId:guid}/fiscal")]
    public async Task<IActionResult> UpdateFiscal(
        Guid receiptId,
        [FromBody] UpdateFiscalRequest request,
        CancellationToken ct)
    {
        const string sql = """
            UPDATE sales_receipts
            SET    fiscal_slip_no  = @slipNo,
                   fiscal_status   = @status,
                   fiscal_synced_at = @syncedAt,
                   fiscal_error    = @error
            WHERE  id = @receiptId;
            """;

        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(sql, new
        {
            receiptId,
            slipNo   = request.FiscalSlipNo,
            status   = request.FiscalStatus,
            syncedAt = request.FiscalSyncedAt,
            error    = request.FiscalError,
        });

        return NoContent();
    }
}
