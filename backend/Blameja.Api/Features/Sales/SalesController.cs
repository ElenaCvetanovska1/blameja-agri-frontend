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

        limit = Math.Clamp(limit, 1, 50);

        // If the query is all-digits, also attempt an exact PLU match
        var pluExact = q.Trim() is { } t && t.Length > 0 && t.All(char.IsDigit) ? t : null;

        // Exact PLU match is ranked first (before LIMIT), so a digit query like "50"
        // always surfaces the PLU-50 product even when many barcodes/names contain "50".
        const string sql = """
            SELECT *
            FROM (
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
                     OR mk_search_norm(name) LIKE '%' || mk_search_norm(@q) || '%'
                     OR plu     ILIKE '%' || @q || '%'
                     OR (@pluExact IS NOT NULL AND plu = @pluExact)
                  )
                ORDER BY product_id, qty_on_hand DESC NULLS LAST
            ) t
            ORDER BY
                CASE WHEN @pluExact IS NOT NULL AND plu = @pluExact THEN 0 ELSE 1 END,
                qty_on_hand DESC NULLS LAST
            LIMIT @limit;
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<ProductStockDto>(sql, new { q = q.Trim(), storeNo, pluExact, limit });

        // Re-sort: exact PLU match first, then by qty_on_hand descending
        var sorted = rows
            .OrderBy(r => pluExact != null && r.Plu == pluExact ? 0 : 1)
            .ThenByDescending(r => r.QtyOnHand)
            .Take(limit);
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

        // PLU match wins over barcode match: typing "50" + Enter must add PLU 50,
        // even if some other product's barcode happens to be exactly "50".
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
            ORDER BY CASE WHEN @pluExact IS NOT NULL AND plu = @pluExact THEN 0 ELSE 1 END
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

        if (request.Payment is not ("CASH" or "CARD"))
            throw new ApiException("Invalid payment method.");

        // "Прима готово" е опционално (null = точен износ); валидирај само ако е внесено.
        if (request.Payment == "CASH" && request.CashReceived is { } cash && cash < request.Total)
            throw new ApiException(
                $"Недоволно готово. Вкупно: {request.Total:F2} / Дава: {cash:F2}.");

        using var conn = db.CreateConnection();

        // ── Stock level check (warning only — sale is allowed to go negative) ─
        conn.Open();

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

        // "Прима готово" е опционално (null = точен износ); валидирај само ако е внесено.
        if (request.Payment == "CASH" && request.CashReceived is { } cash2 && cash2 < request.Total)
            throw new ApiException(
                $"Недоволно готово. Вкупно: {request.Total:F2} / Дава: {cash2:F2}.");

        using var tx = conn.BeginTransaction();

        const string receiptSql = """
            INSERT INTO sales_receipts (payment, total, cash_received)
            VALUES (@payment::payment_method, @total, @cashReceived)
            RETURNING id, receipt_no;
            """;

        // DB правило (sales_receipts_cash_received_rule):
        //   CARD → cash_received МОРА да е NULL;  CASH → cash_received МОРА да е NOT NULL.
        // „Прима готово" е опционално: за CASH со празно поле → точен износ (= total, кусур 0).
        decimal? cashReceived = request.Payment == "CASH"
            ? (request.CashReceived ?? request.Total)
            : null;

        var receipt = await conn.QuerySingleAsync<(Guid Id, int ReceiptNo)>(receiptSql, new
        {
            payment      = request.Payment,
            total        = request.Total,
            cashReceived,
        }, tx);

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
            }, tx);
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

        var movementId = await conn.ExecuteScalarAsync<Guid>(movSql, new { note }, tx);

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
            }, tx);
        }

        tx.Commit();

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
        using var conn = db.CreateConnection();
        conn.Open();
        using var tx = conn.BeginTransaction();

        // ── 1. Update the sales_receipts fiscal fields ─────────────────────────
        await conn.ExecuteAsync(
            """
            UPDATE sales_receipts
            SET    fiscal_slip_no   = @slipNo,
                   fiscal_status    = @status,
                   fiscal_synced_at = @syncedAt,
                   fiscal_error     = @error
            WHERE  id = @receiptId;
            """,
            new
            {
                receiptId,
                slipNo   = request.FiscalSlipNo,
                status   = request.FiscalStatus,
                syncedAt = request.FiscalSyncedAt,
                error    = request.FiscalError,
            },
            tx);

        // ── 2. On SUCCESS, materialise a fiscal_receipts archive row (+ items) ─
        //    so the receipt appears in Сторно and can be reversed. Idempotent:
        //    a second PATCH (or re-sync) won't create a duplicate.
        if (request.FiscalStatus == "success")
        {
            var exists = await conn.ExecuteScalarAsync<Guid?>(
                "SELECT id FROM fiscal_receipts WHERE sales_receipt_id = @receiptId AND receipt_type = 'sale' LIMIT 1;",
                new { receiptId }, tx);

            if (exists is null)
            {
                var frId = Guid.NewGuid();
                var now  = DateTime.UtcNow;

                // Header — copied from the sale.
                await conn.ExecuteAsync(
                    """
                    INSERT INTO fiscal_receipts (
                        id, sales_receipt_id, receipt_type, fiscal_slip_no, fiscal_status, fiscal_error,
                        store_no, payment, total, cash_received, created_by, fiscalized_at, created_at
                    )
                    SELECT
                        @frId, sr.id, 'sale', @slipNo, 'success', NULL,
                        sr.store_no, sr.payment, sr.total, sr.cash_received, sr.created_by, @now, @now
                    FROM sales_receipts sr
                    WHERE sr.id = @receiptId;
                    """,
                    new { frId, slipNo = request.FiscalSlipNo, now, receiptId }, tx);

                // Items — from sales_items joined with products. tax_group (percent) → fiscal code 1-4.
                await conn.ExecuteAsync(
                    """
                    INSERT INTO fiscal_receipt_items (
                        fiscal_receipt_id, sales_item_id, product_id, plu, fiscal_plu, product_name,
                        quantity, unit_price, line_total, discount, base_price,
                        tax_group, tax_percent, is_macedonian, unit, barcode, created_at
                    )
                    SELECT
                        @frId, si.id, si.product_id, p.plu, p.fiscal_plu, COALESCE(p.name, 'Производ'),
                        si.qty, si.price, si.price * si.qty, si.discount, si.base_price,
                        CASE p.tax_group WHEN 18 THEN 1 WHEN 5 THEN 2 WHEN 10 THEN 3 ELSE 4 END,
                        p.tax_group, COALESCE(p.is_macedonian, false), p.unit, p.barcode, @now
                    FROM sales_items si
                    JOIN products p ON p.id = si.product_id
                    WHERE si.receipt_id = @receiptId;
                    """,
                    new { frId, now, receiptId }, tx);
            }
        }

        tx.Commit();
        return NoContent();
    }
}
