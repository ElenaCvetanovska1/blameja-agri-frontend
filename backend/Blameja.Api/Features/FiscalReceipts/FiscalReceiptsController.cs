using Blameja.Api.Features.FiscalReceipts.Dtos;
using Blameja.Api.Infrastructure.Database;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.FiscalReceipts;

/// <summary>
/// Archive of fiscal receipts and their line items.
/// Provides list, detail, and STORNO creation endpoints.
/// </summary>
[ApiController]
[Route("api/fiscal-receipts")]
[Authorize]
public sealed class FiscalReceiptsController(DbConnectionFactory db) : ControllerBase
{
    // ── GET /api/fiscal-receipts?days=30 ───────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] int days = 30,
        CancellationToken ct = default)
    {
        const string sql = """
            SELECT
                id,
                sales_receipt_id,
                receipt_type,
                fiscal_slip_no,
                fiscal_status,
                fiscal_error,
                store_no,
                payment,
                total,
                external_doc_no,
                created_by,
                fiscalized_at,
                created_at,
                original_fiscal_receipt_id
            FROM fiscal_receipts
            WHERE created_at >= NOW() - (@days || ' days')::interval
            ORDER BY created_at DESC;
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<FiscalReceiptListDto>(sql, new { days });
        return Ok(rows);
    }

    // ── GET /api/fiscal-receipts/{id} ──────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetDetail(
        Guid id,
        CancellationToken ct = default)
    {
        using var conn = db.CreateConnection();

        const string headerSql = """
            SELECT
                id,
                sales_receipt_id,
                receipt_type,
                fiscal_slip_no,
                fiscal_status,
                fiscal_error,
                store_no,
                payment,
                total,
                cash_received,
                paid_amount,
                change_amount,
                subtotal,
                external_doc_no,
                created_by,
                bridge_response,
                fiscalized_at,
                created_at,
                original_fiscal_receipt_id
            FROM fiscal_receipts
            WHERE id = @id;
            """;

        var receipt = await conn.QuerySingleOrDefaultAsync<FiscalReceiptDetailDto>(
            headerSql, new { id });

        if (receipt is null)
            return NotFound(new { message = $"Фискална сметка {id} не е пронајдена." });

        // Items with remaining_qty — how much of each line can still be storno'd.
        // remaining_qty = original quantity minus already returned (sum of linked storno items).
        const string itemsSql = """
            SELECT
                i.id,
                i.fiscal_receipt_id,
                i.sales_item_id,
                i.product_id,
                i.plu,
                i.fiscal_plu,
                i.product_name,
                i.quantity,
                i.unit_price,
                i.line_total,
                i.discount,
                i.base_price,
                i.tax_group,
                i.tax_percent,
                i.is_macedonian,
                i.unit,
                i.barcode,
                i.original_fiscal_receipt_item_id,
                i.created_at,
                i.quantity - COALESCE(SUM(s.quantity), 0) AS remaining_qty
            FROM fiscal_receipt_items i
            LEFT JOIN fiscal_receipt_items s ON s.original_fiscal_receipt_item_id = i.id
            WHERE i.fiscal_receipt_id = @id
            GROUP BY
                i.id, i.fiscal_receipt_id, i.sales_item_id, i.product_id,
                i.plu, i.fiscal_plu, i.product_name, i.quantity, i.unit_price,
                i.line_total, i.discount, i.base_price, i.tax_group, i.tax_percent,
                i.is_macedonian, i.unit, i.barcode, i.original_fiscal_receipt_item_id,
                i.created_at
            ORDER BY i.created_at;
            """;

        var items = await conn.QueryAsync<FiscalReceiptItemDto>(itemsSql, new { id });

        return Ok(new { receipt, items });
    }

    // ── POST /api/fiscal-receipts/{id}/storno ──────────────────────────────
    /// <summary>
    /// Validates selected items + quantities, then persists a new storno receipt.
    /// The FiscalBridge execution is performed by the frontend before calling this endpoint;
    /// the fiscal result (slip_no, status, bridge_response) is included in the request body.
    /// </summary>
    [HttpPost("{id:guid}/storno")]
    public async Task<IActionResult> CreateStorno(
        Guid id,
        [FromBody] StornoRequestDto req,
        CancellationToken ct = default)
    {
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { message = "Мора да се изберат ставки за сторно." });

        using var conn = db.CreateConnection();
        conn.Open();

        // ── 1. Load and validate the original receipt ──────────────────────
        const string origSql = """
            SELECT id, receipt_type, fiscal_status, store_no, payment, created_by, fiscal_slip_no
            FROM fiscal_receipts
            WHERE id = @id;
            """;

        var original = await conn.QuerySingleOrDefaultAsync<OriginalReceiptRow>(origSql, new { id });

        if (original is null)
            return NotFound(new { message = $"Фискална сметка {id} не е пронајдена." });

        if (original.ReceiptType != "sale")
            return BadRequest(new { message = "Само продажби можат да се сторнираат." });

        if (original.FiscalStatus != "success")
            return BadRequest(new { message = "Само успешно фискализирани сметки можат да се сторнираат." });

        // ── 2. Load original items with remaining returnable quantity ───────
        const string itemsSql = """
            SELECT
                i.id,
                i.product_id,
                i.plu,
                i.fiscal_plu,
                i.product_name,
                i.unit_price,
                i.base_price,
                i.tax_group,
                i.tax_percent,
                i.is_macedonian,
                i.unit,
                i.barcode,
                i.quantity - COALESCE(SUM(s.quantity), 0) AS remaining_qty
            FROM fiscal_receipt_items i
            LEFT JOIN fiscal_receipt_items s ON s.original_fiscal_receipt_item_id = i.id
            WHERE i.fiscal_receipt_id = @id
            GROUP BY
                i.id, i.product_id, i.plu, i.fiscal_plu, i.product_name,
                i.unit_price, i.base_price, i.tax_group, i.tax_percent,
                i.is_macedonian, i.unit, i.barcode, i.quantity;
            """;

        var originalItems = (await conn.QueryAsync<OriginalItemRow>(itemsSql, new { id }))
            .ToDictionary(x => x.Id);

        // ── 3. Validate requested quantities ───────────────────────────────
        foreach (var reqItem in req.Items)
        {
            if (!originalItems.TryGetValue(reqItem.OriginalItemId, out var origItem))
                return BadRequest(new { message = $"Ставката {reqItem.OriginalItemId} не припаѓа на оваа сметка." });

            if (reqItem.Quantity <= 0)
                return BadRequest(new { message = $"Количината мора да биде поголема од 0." });

            if (reqItem.Quantity > origItem.RemainingQty)
                return BadRequest(new
                {
                    message = $"Побараното количество ({reqItem.Quantity}) надминува расположивото ({origItem.RemainingQty}) за '{origItem.ProductName}'."
                });
        }

        // ── 4. Persist storno receipt + items in a transaction ─────────────
        using var tx = conn.BeginTransaction();
        try
        {
            var newId  = Guid.NewGuid();
            var now    = DateTime.UtcNow;
            var slipNo = req.FiscalSlipNo;

            await conn.ExecuteAsync(
                """
                INSERT INTO fiscal_receipts (
                    id, receipt_type, fiscal_slip_no, fiscal_status, fiscal_error,
                    store_no, payment, total, created_by, bridge_response,
                    fiscalized_at, created_at, original_fiscal_receipt_id
                ) VALUES (
                    @Id, 'storno', @FiscalSlipNo, @FiscalStatus, @FiscalError,
                    @StoreNo, @Payment, @Total, @CreatedBy, @BridgeResponse,
                    @FiscalizedAt, @CreatedAt, @OriginalId
                );
                """,
                new
                {
                    Id            = newId,
                    FiscalSlipNo  = slipNo,
                    req.FiscalStatus,
                    req.FiscalError,
                    StoreNo       = req.StoreNo ?? original.StoreNo,
                    req.Payment,
                    req.Total,
                    CreatedBy     = req.CreatedBy ?? original.CreatedBy,
                    req.BridgeResponse,
                    FiscalizedAt  = req.FiscalStatus == "success" ? now : (DateTime?)null,
                    CreatedAt     = now,
                    OriginalId    = id,
                },
                tx);

            foreach (var reqItem in req.Items)
            {
                var orig = originalItems[reqItem.OriginalItemId];
                var lineTotal = orig.UnitPrice * reqItem.Quantity;

                await conn.ExecuteAsync(
                    """
                    INSERT INTO fiscal_receipt_items (
                        id, fiscal_receipt_id, product_id, plu, fiscal_plu, product_name,
                        quantity, unit_price, line_total, discount, base_price,
                        tax_group, tax_percent, is_macedonian, unit, barcode,
                        created_at, original_fiscal_receipt_item_id
                    ) VALUES (
                        gen_random_uuid(), @FiscalReceiptId, @ProductId, @Plu, @FiscalPlu, @ProductName,
                        @Quantity, @UnitPrice, @LineTotal, 0, @BasePrice,
                        @TaxGroup, @TaxPercent, @IsMacedonian, @Unit, @Barcode,
                        @CreatedAt, @OriginalItemId
                    );
                    """,
                    new
                    {
                        FiscalReceiptId  = newId,
                        orig.ProductId,
                        orig.Plu,
                        orig.FiscalPlu,
                        orig.ProductName,
                        Quantity         = reqItem.Quantity,
                        orig.UnitPrice,
                        LineTotal        = lineTotal,
                        orig.BasePrice,
                        orig.TaxGroup,
                        orig.TaxPercent,
                        IsMacedonian     = orig.IsMacedonian,
                        orig.Unit,
                        orig.Barcode,
                        CreatedAt        = now,
                        OriginalItemId   = reqItem.OriginalItemId,
                    },
                    tx);
            }

            // ── 5. Restore stock — only on successful fiscal storno ────────────
            // Stock reversal is tied to confirmed fiscalization.
            // If the fiscal device did not successfully issue the storno receipt,
            // no stock movement is created (failed/offline storno = no stock change).
            var stockItems = req.FiscalStatus == "success"
                ? req.Items
                    .Select(reqItem => (reqItem, orig: originalItems[reqItem.OriginalItemId]))
                    .Where(x => x.orig.ProductId.HasValue)
                    .ToList()
                : [];

            if (stockItems.Count > 0)
            {
                var origSlip  = original.FiscalSlipNo?.ToString() ?? id.ToString()[..8];
                var stornoSlip = slipNo?.ToString() ?? newId.ToString()[..8];
                var movNote   = $"Storno #{stornoSlip} (original sale #{origSlip})";

                const string movSql = """
                    INSERT INTO stock_movements (type, note)
                    VALUES ('IN', @note)
                    RETURNING id;
                    """;

                var movementId = await conn.ExecuteScalarAsync<Guid>(movSql, new { note = movNote }, tx);

                const string movItemSql = """
                    INSERT INTO stock_movement_items (movement_id, product_id, qty, unit_cost, unit_price)
                    VALUES (@movementId, @productId, @qty, 0, @unitPrice);
                    """;

                foreach (var (reqItem, orig) in stockItems)
                {
                    await conn.ExecuteAsync(movItemSql, new
                    {
                        movementId,
                        productId  = orig.ProductId!.Value,
                        qty        = reqItem.Quantity,
                        unitPrice  = orig.UnitPrice,
                    }, tx);
                }
            }

            tx.Commit();
            return Ok(new { id = newId });
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // ── Private projection records ─────────────────────────────────────────

    private sealed record OriginalReceiptRow(
        Guid    Id,
        string? ReceiptType,
        string? FiscalStatus,
        int?    StoreNo,
        string? Payment,
        string? CreatedBy,
        int?    FiscalSlipNo);

    private sealed record OriginalItemRow(
        Guid     Id,
        Guid?    ProductId,
        string?  Plu,
        int?     FiscalPlu,
        string?  ProductName,
        decimal  UnitPrice,
        decimal  BasePrice,
        int?     TaxGroup,
        decimal? TaxPercent,
        bool     IsMacedonian,
        string?  Unit,
        string?  Barcode,
        decimal  RemainingQty);
}
