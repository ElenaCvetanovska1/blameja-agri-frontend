using Blameja.Api.Features.Suppliers.Dtos;
using Blameja.Api.Infrastructure.Database;
using Blameja.Api.Middleware;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.Suppliers;

/// <summary>
/// Supplier search and address update.
/// Replaces direct Supabase RPC calls from:
///   useSupplierChoices.ts (suppliers_search RPC)
///   useUpdateSupplierAddressMutation.ts (supplier_update_address RPC)
/// </summary>
[ApiController]
[Route("api/suppliers")]
[Authorize]
public sealed class SuppliersController(DbConnectionFactory db) : ControllerBase
{
    // ── GET /api/suppliers/search ──────────────────────────────────────────
    /// <summary>
    /// Search suppliers by name using the suppliers_search PostgreSQL function.
    /// Passing q="" returns all (browse mode). Replaces useSupplierChoices.ts RPC.
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> SearchSuppliers(
        [FromQuery] string? q,
        [FromQuery] int     limit = 12,
        CancellationToken   ct    = default)
    {
        // Delegates to the same PostgreSQL function that Supabase RPC called.
        // suppliers_search(_q text, _limit int) returns table(id, name, address)
        const string sql = "SELECT * FROM suppliers_search(@q, @limit);";

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<SupplierDto>(sql, new { q = q ?? string.Empty, limit });
        return Ok(rows);
    }

    // ── POST /api/suppliers/get-or-create ─────────────────────────────────
    /// <summary>
    /// Find an existing supplier by name or create a new one.
    /// Replaces direct supabase.rpc('suppliers_get_or_create') call in receive/page.tsx.
    /// </summary>
    [HttpPost("get-or-create")]
    public async Task<IActionResult> GetOrCreate(
        [FromBody] GetOrCreateSupplierRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ApiException("Името на добавувачот не може да биде празно.");

        const string sql = "SELECT * FROM suppliers_get_or_create(@name::text, @address::text);";

        using var conn = db.CreateConnection();
        var row = await conn.QuerySingleOrDefaultAsync<SupplierDto>(sql, new
        {
            name    = request.Name.Trim(),
            address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
        });

        if (row is null)
            return StatusCode(500, new { error = "Не успеа креирање/наоѓање на добавувач." });

        return Ok(row);
    }

    // ── PATCH /api/suppliers/{id}/address ─────────────────────────────────
    /// <summary>
    /// Update supplier address via the supplier_update_address PostgreSQL function.
    /// Replaces useUpdateSupplierAddressMutation.ts RPC call.
    /// </summary>
    [HttpPatch("{supplierId}/address")]
    public async Task<IActionResult> UpdateAddress(
        string supplierId,
        [FromBody] UpdateSupplierAddressRequest request,
        CancellationToken ct)
    {
        var address = request.Address?.Trim();
        if (string.IsNullOrEmpty(address))
            throw new ApiException("Адресата не може да биде празна.");

        // Calls the same RLS-protected function used by the frontend Supabase RPC
        const string sql = "SELECT supplier_update_address(@supplierId::uuid, @address::text);";

        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(sql, new { supplierId, address });
        return NoContent();
    }
}
