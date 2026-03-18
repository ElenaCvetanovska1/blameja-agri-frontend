using Blameja.Api.Features.Finance.Dtos;
using Blameja.Api.Infrastructure.Database;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.Finance;

/// <summary>
/// Financial reporting: daily sales summary and top products.
/// Delegates to the same PostgreSQL functions the frontend called via Supabase RPC.
/// Replaces useDailySales.ts, useTopProducts.ts
/// </summary>
[ApiController]
[Route("api/finance")]
[Authorize]
public sealed class FinanceController(DbConnectionFactory db) : ControllerBase
{
    // ── GET /api/finance/daily-sales ───────────────────────────────────────
    /// <summary>
    /// Daily sales aggregates for a date range.
    /// Calls the finance_daily_sales(_from, _to) PostgreSQL function.
    /// Replaces useDailySales.ts RPC call.
    /// </summary>
    [HttpGet("daily-sales")]
    public async Task<IActionResult> GetDailySales(
        [FromQuery] string from,
        [FromQuery] string to,
        CancellationToken  ct = default)
    {
        // The function returns: day (date), receipts_count (bigint), total (numeric)
        const string sql = """
            SELECT
                day::text        AS day,
                receipts_count::int AS receipts_count,
                total::numeric   AS total
            FROM finance_daily_sales(@from::date, @to::date);
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<DailySalesDto>(sql, new { from, to });
        return Ok(rows);
    }

    // ── GET /api/finance/top-products ──────────────────────────────────────
    /// <summary>
    /// Top-selling products by revenue for a date range.
    /// Calls the finance_top_products(_from, _to, _limit) PostgreSQL function.
    /// Replaces useTopProducts.ts RPC call.
    /// </summary>
    [HttpGet("top-products")]
    public async Task<IActionResult> GetTopProducts(
        [FromQuery] string from,
        [FromQuery] string to,
        [FromQuery] int    limit = 8,
        CancellationToken  ct   = default)
    {
        const string sql = """
            SELECT
                product_id,
                plu::text       AS plu,
                name,
                qty::numeric    AS qty,
                revenue::numeric AS revenue
            FROM finance_top_products(@from::date, @to::date, @limit::int);
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<TopProductDto>(sql, new { from, to, limit });
        return Ok(rows);
    }
}
