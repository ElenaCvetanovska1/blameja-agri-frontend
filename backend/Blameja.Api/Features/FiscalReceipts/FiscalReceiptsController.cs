using Blameja.Api.Features.FiscalReceipts.Dtos;
using Blameja.Api.Infrastructure.Database;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.FiscalReceipts;

/// <summary>
/// Read-only archive of fiscal receipts and their line items.
/// Provides the data layer for the Фискални сметки page.
/// Prepared for future STORNO: detail endpoint returns full item breakdown.
/// </summary>
[ApiController]
[Route("api/fiscal-receipts")]
[Authorize]
public sealed class FiscalReceiptsController(DbConnectionFactory db) : ControllerBase
{
    // ── GET /api/fiscal-receipts?days=30 ───────────────────────────────────
    /// <summary>
    /// Returns fiscal receipts from the last N days, newest first.
    /// Default window: 30 days.
    /// </summary>
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
                created_at
            FROM fiscal_receipts
            WHERE created_at >= NOW() - (@days || ' days')::interval
            ORDER BY created_at DESC;
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<FiscalReceiptListDto>(sql, new { days });
        return Ok(rows);
    }

    // ── GET /api/fiscal-receipts/{id} ──────────────────────────────────────
    /// <summary>
    /// Returns one fiscal receipt with all its line items.
    /// Structure: { receipt: FiscalReceiptDetailDto, items: FiscalReceiptItemDto[] }
    /// The items list is the basis for future STORNO selection.
    /// </summary>
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
                created_at
            FROM fiscal_receipts
            WHERE id = @id;
            """;

        var receipt = await conn.QuerySingleOrDefaultAsync<FiscalReceiptDetailDto>(
            headerSql, new { id });

        if (receipt is null)
            return NotFound(new { message = $"Фискална сметка {id} не е пронајдена." });

        const string itemsSql = """
            SELECT
                id,
                fiscal_receipt_id,
                sales_item_id,
                product_id,
                plu,
                fiscal_plu,
                product_name,
                quantity,
                unit_price,
                line_total,
                discount,
                base_price,
                tax_group,
                tax_percent,
                is_macedonian,
                unit,
                barcode,
                created_at
            FROM fiscal_receipt_items
            WHERE fiscal_receipt_id = @id
            ORDER BY created_at;
            """;

        var items = await conn.QueryAsync<FiscalReceiptItemDto>(itemsSql, new { id });

        return Ok(new { receipt, items });
    }
}
