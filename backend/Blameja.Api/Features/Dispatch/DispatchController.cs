using Blameja.Api.Features.Dispatch.Dtos;
using Blameja.Api.Infrastructure.Database;
using Blameja.Api.Middleware;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.Dispatch;

/// <summary>
/// Document dispatch: product search, buyer list, dispatch document submission.
/// Replaces all direct Supabase calls from:
///   useDispatchProductSearch.ts, useBuyerChoices.ts, useDispatchSubmit.ts
/// </summary>
[ApiController]
[Route("api/dispatch")]
[Authorize]
public sealed class DispatchController(DbConnectionFactory db) : ControllerBase
{
    // ── GET /api/dispatch/products/search ──────────────────────────────────
    /// <summary>
    /// Product search for dispatch document line items.
    /// Mirrors the dual-query logic (ILIKE + exact PLU) of useDispatchProductSearch.ts.
    /// </summary>
    [HttpGet("products/search")]
    public async Task<IActionResult> SearchProducts(
        [FromQuery] string q,
        [FromQuery] int    limit = 8,
        CancellationToken  ct   = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<DispatchProductDto>());

        var term     = q.Trim();
        var pluExact = term.All(char.IsDigit) ? term : null;

        const string sql = """
            SELECT DISTINCT ON (id)
                id,
                plu,
                barcode,
                name,
                COALESCE(unit, 'пар') AS unit,
                selling_price
            FROM products
            WHERE name    ILIKE '%' || @term || '%'
               OR plu     ILIKE '%' || @term || '%'
               OR barcode ILIKE '%' || @term || '%'
               OR (@pluExact IS NOT NULL AND plu = @pluExact)
            ORDER BY id, name ASC
            LIMIT @limit;
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<DispatchProductDto>(sql, new { term, pluExact, limit });

        // Normalize unit — matches normalizeSuggestion() in frontend utils
        var result = rows.Select(r => new DispatchProductDto
        {
            Id           = r.Id,
            Plu          = r.Plu,
            Barcode      = r.Barcode,
            Name         = r.Name,
            Unit         = r.Unit is "кг" or "м" or "пар" ? r.Unit : "пар",
            SellingPrice = r.SellingPrice,
        });

        return Ok(result);
    }

    // ── GET /api/buyers ────────────────────────────────────────────────────
    /// <summary>
    /// Full buyer list using the buyers_all() PostgreSQL function.
    /// Replaces useBuyerChoices.ts (RPC buyers_all with paged fetching).
    /// Returns all buyers in one call — the function handles pagination internally.
    /// </summary>
    [HttpGet("/api/buyers")]
    public async Task<IActionResult> GetBuyers(CancellationToken ct = default)
    {
        const string sql = "SELECT * FROM buyers_all();";

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<BuyerDto>(sql);
        return Ok(rows);
    }

    // ── POST /api/dispatch ─────────────────────────────────────────────────
    /// <summary>
    /// Submit a dispatch document.
    /// Performs the same 4-table write sequence as useDispatchSubmit.ts:
    ///   sales_receipts (DISPATCH) → sales_items → stock_movements OUT → stock_movement_items
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SubmitDispatch(
        [FromBody] SubmitDispatchRequest request,
        CancellationToken ct)
    {
        if (request.Items is null || request.Items.Count == 0)
            throw new ApiException("Нема ставки за зачувување.");

        foreach (var r in request.Items)
        {
            if (string.IsNullOrWhiteSpace(r.ProductId))
                throw new ApiException(
                    $"Недостасува productId за ставка \"{r.Naziv}\". Избери производ од предлози.");
            if (r.Qty <= 0)
                throw new ApiException($"Количината мора да е > 0 за \"{r.Naziv}\".");
        }

        using var conn = db.CreateConnection();

        // ── 1. Insert sales_receipts (DISPATCH) ────────────────────────────
        const string receiptSql = """
            INSERT INTO sales_receipts (doc_type, external_doc_no, total, payment, cash_received)
            VALUES ('DISPATCH', @docNo, @total, NULL, NULL)
            RETURNING id, receipt_no;
            """;

        var receipt = await conn.QuerySingleAsync<(Guid Id, int ReceiptNo)>(receiptSql, new
        {
            docNo = request.DocNo,
            total = Math.Round(request.Total, 2),
        });

        // ── 2. Insert sales_items ──────────────────────────────────────────
        const string itemSql = """
            INSERT INTO sales_items (receipt_id, product_id, qty, base_price, price, discount)
            VALUES (@receiptId, @productId::uuid, @qty, @basePrice, @finalPrice, @discount);
            """;

        foreach (var item in request.Items)
        {
            var finalPrice = Math.Min(item.ProdaznaCena, item.Cena);
            var discount   = Math.Round(item.Cena - finalPrice, 4);

            await conn.ExecuteAsync(itemSql, new
            {
                receiptId  = receipt.Id,
                productId  = item.ProductId,
                qty        = item.Qty,
                basePrice  = item.Cena,
                finalPrice,
                discount,
            });
        }

        // ── 3. Insert stock_movements OUT ──────────────────────────────────
        var note = !string.IsNullOrWhiteSpace(request.Note)
            ? request.Note.Trim()[..Math.Min(500, request.Note.Trim().Length)]
            : $"ИСПРАТНИЦА бр. {request.DocNo} ({request.DocDate})";

        const string movSql = """
            INSERT INTO stock_movements (type, note)
            VALUES ('OUT', @note)
            RETURNING id;
            """;

        var movementId = await conn.ExecuteScalarAsync<Guid>(movSql, new { note });

        // ── 4. Insert stock_movement_items ─────────────────────────────────
        const string movItemSql = """
            INSERT INTO stock_movement_items (movement_id, product_id, qty, unit_cost, unit_price)
            VALUES (@movementId, @productId::uuid, @qty, 0, @unitPrice);
            """;

        foreach (var item in request.Items)
        {
            var finalPrice = Math.Min(item.ProdaznaCena, item.Cena);
            await conn.ExecuteAsync(movItemSql, new
            {
                movementId,
                productId  = item.ProductId,
                qty        = item.Qty,
                unitPrice  = finalPrice,
            });
        }

        return Ok(new DispatchReceiptDto { Id = receipt.Id, ReceiptNo = receipt.ReceiptNo });
    }
}
