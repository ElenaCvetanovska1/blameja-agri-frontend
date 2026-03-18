using Blameja.Api.Features.Receive.Dtos;
using Blameja.Api.Infrastructure.Database;
using Blameja.Api.Middleware;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.Receive;

/// <summary>
/// Stock receiving: product search/lookup, stock lookup, receive submission.
/// Replaces all direct Supabase calls from:
///   useProductChoices.ts, useStockLookup.ts, useProductLookup.ts,
///   useCategoryOptions.ts, useCategoryTree.ts, useReceiveMutation.ts
/// </summary>
[ApiController]
[Route("api/receive")]
[Authorize]
public sealed class ReceiveController(DbConnectionFactory db) : ControllerBase
{
    // ── GET /api/receive/products/search ───────────────────────────────────
    /// <summary>Product autocomplete for the receive form. Replaces useProductChoices.ts</summary>
    [HttpGet("products/search")]
    public async Task<IActionResult> SearchProducts(
        [FromQuery] string  q,
        [FromQuery] string? categoryId,
        [FromQuery] int?    storeNo,
        [FromQuery] int     limit = 10,
        CancellationToken   ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<ReceiveProductChoiceDto>());

        var catId = string.IsNullOrWhiteSpace(categoryId) ? null : categoryId;

        // Parse categoryId to Guid (nullable)
        Guid? catGuid = catId is not null && Guid.TryParse(catId, out var g) ? g : null;

        const string sql = """
            SELECT
                p.id,
                p.name,
                p.plu,
                p.barcode,
                p.selling_price,
                p.tax_group,
                p.category_id,
                p.unit,
                p.store_no,
                c.name AS category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.is_active = true
              AND p.name ILIKE '%' || @q || '%'
              AND (@catId IS NULL OR p.category_id = @catId)
              AND (@storeNo IS NULL OR p.store_no = @storeNo)
            ORDER BY p.name ASC
            LIMIT @limit;
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<ReceiveProductChoiceDto>(sql, new
        {
            q      = q.Trim(),
            catId  = catGuid,
            storeNo,
            limit,
        });

        return Ok(rows);
    }

    // ── GET /api/receive/stock/lookup ──────────────────────────────────────
    /// <summary>Lookup existing stock record by barcode or PLU. Replaces useStockLookup.ts</summary>
    [HttpGet("stock/lookup")]
    public async Task<IActionResult> LookupStock(
        [FromQuery] string code,
        CancellationToken  ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Ok((StockLookupDto?)null);

        var trimmed  = code.Trim();
        var pluExact = trimmed.All(char.IsDigit) ? trimmed : null;

        const string sql = """
            SELECT product_id, plu, barcode, name, selling_price, qty_on_hand, category_name
            FROM product_stock
            WHERE barcode = @trimmed
               OR (@pluExact IS NOT NULL AND plu = @pluExact)
            LIMIT 1;
            """;

        using var conn = db.CreateConnection();
        var row = await conn.QuerySingleOrDefaultAsync<StockLookupDto>(sql, new { trimmed, pluExact });
        return Ok(row);
    }

    // ── GET /api/receive/products/lookup ───────────────────────────────────
    /// <summary>Lookup product master record by barcode or PLU. Replaces useProductLookup.ts</summary>
    [HttpGet("products/lookup")]
    public async Task<IActionResult> LookupProduct(
        [FromQuery] string code,
        CancellationToken  ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Ok((ProductLookupDto?)null);

        var trimmed  = code.Trim();
        var pluExact = trimmed.All(char.IsDigit) ? trimmed : null;

        const string sql = """
            SELECT id, plu, barcode, name, description, unit, selling_price,
                   tax_group, category_id, subcategory_id
            FROM products
            WHERE barcode = @trimmed
               OR (@pluExact IS NOT NULL AND plu = @pluExact)
            LIMIT 1;
            """;

        using var conn = db.CreateConnection();
        var row = await conn.QuerySingleOrDefaultAsync<ProductLookupDto>(sql, new { trimmed, pluExact });

        if (row is not null)
        {
            // Normalize unit — matches frontend normalizeUnit()
            var unit = row.Unit is "кг" or "м" or "пар" ? row.Unit : "пар";
            row = row with { Unit = unit };
        }

        return Ok(row);
    }

    // ── POST /api/receive ──────────────────────────────────────────────────
    /// <summary>
    /// Submit a stock receipt:
    ///   - Upsert product (create new or update existing)
    ///   - Insert stock_movements IN + stock_movement_items
    /// Exact port of useReceiveMutation.ts logic.
    /// User ID is extracted from the JWT — never trusted from the request body.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> SubmitReceive(
        [FromBody] ReceivePayloadRequest request,
        CancellationToken ct)
    {
        // ── Parse + validate ───────────────────────────────────────────────
        var plu = ParsePluRequired(request.Plu)
            ?? throw new ApiException("PLU е задолжителен.");

        var name = request.Name?.Trim()
            ?? throw new ApiException("Ime на производ е задолжително.");
        if (string.IsNullOrEmpty(name))
            throw new ApiException("Ime на производ е задолжително.");

        var qty = ParseNum(request.Qty)
            ?? throw new ApiException("Количина: невалиден број.");
        if (qty <= 0)
            throw new ApiException("Количина мора да е > 0.");

        if (!int.TryParse(request.TaxGroup, out var taxGroup) || !new[] { 5, 10, 18 }.Contains(taxGroup))
            throw new ApiException("ДДВ: невалидно.");

        var unitCost     = ParseNum(request.UnitCost) ?? 0;
        var sellingPrice = ParseNum(request.SellingPrice) ?? 0;
        var barcode      = NullIfEmpty(request.Barcode);
        var description  = NullIfEmpty(request.Description);
        var note         = NullIfEmpty(request.Note) ?? "Прием на стока";
        var unit         = NormalizeUnit(request.Unit);
        var storeNo      = request.StoreNo is 20 or 30 ? request.StoreNo : 20;
        var supplierId   = NullIfEmptyGuid(request.SupplierId);
        Guid? categoryId = Guid.TryParse(request.CategoryId, out var cg) ? cg : null;

        // User ID from JWT sub claim
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;

        using var conn = db.CreateConnection();

        // ── Lookup existing product by PLU or barcode ──────────────────────
        const string lookupSql = """
            SELECT id, plu, barcode
            FROM products
            WHERE (plu = @plu OR (@barcode IS NOT NULL AND barcode = @barcode))
              AND is_active = true
            LIMIT 1;
            """;

        var existing = await conn.QuerySingleOrDefaultAsync<(Guid Id, string? Plu, string? Barcode)>(
            lookupSql, new { plu, barcode });

        Guid productId;

        if (existing == default)
        {
            // ── INSERT new product ─────────────────────────────────────────
            const string insertSql = """
                INSERT INTO products
                    (plu, barcode, name, description, selling_price, tax_group,
                     is_active, category_id, unit, store_no)
                VALUES
                    (@plu, @barcode, @name, @description, @sellingPrice, @taxGroup,
                     true, @categoryId, @unit, @storeNo)
                RETURNING id;
                """;

            productId = await conn.ExecuteScalarAsync<Guid>(insertSql, new
            {
                plu, barcode, name, description,
                sellingPrice, taxGroup, categoryId, unit, storeNo,
            });
        }
        else
        {
            productId = existing.Id;

            // ── UPDATE existing product ────────────────────────────────────
            // Selling price only updated if provided (non-null)
            var priceUpdate = ParseNum(request.SellingPrice) is { } sp
                ? "selling_price = @sellingPrice,"
                : string.Empty;

            var barcodeUpdate = barcode is not null
                ? "barcode = @barcode,"
                : string.Empty;

            var descUpdate = description is not null
                ? "description = @description,"
                : string.Empty;

            var updateSql = $"""
                UPDATE products
                SET    category_id   = @categoryId,
                       is_active     = true,
                       tax_group     = @taxGroup,
                       plu           = @plu,
                       name          = @name,
                       unit          = @unit,
                       store_no      = @storeNo,
                       {barcodeUpdate}
                       {descUpdate}
                       {priceUpdate}
                       updated_at    = NOW()
                WHERE  id = @productId;
                """;

            await conn.ExecuteAsync(updateSql, new
            {
                productId, categoryId, taxGroup, plu, name, unit, storeNo,
                barcode, description, sellingPrice,
            });
        }

        // ── Insert stock_movements IN ──────────────────────────────────────
        const string movSql = """
            INSERT INTO stock_movements (type, note, created_by, supplier_id)
            VALUES ('IN', @note, @userId::uuid, @supplierId::uuid)
            RETURNING id;
            """;

        var movementId = await conn.ExecuteScalarAsync<Guid>(movSql, new
        {
            note,
            userId   = userId,
            supplierId = supplierId,
        });

        // ── Insert stock_movement_items ────────────────────────────────────
        const string itemSql = """
            INSERT INTO stock_movement_items (movement_id, product_id, qty, unit_cost, unit_price)
            VALUES (@movementId, @productId, @qty, @unitCost, @unitPrice);
            """;

        await conn.ExecuteAsync(itemSql, new
        {
            movementId,
            productId,
            qty,
            unitCost,
            unitPrice = sellingPrice,
        });

        return Ok(new ReceiveResult(productId, movementId));
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private static decimal? ParseNum(string? raw)
    {
        var t = raw?.Trim().Replace(',', '.');
        if (string.IsNullOrEmpty(t)) return null;
        return decimal.TryParse(t, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : null;
    }

    private static string? ParsePluRequired(string? raw)
    {
        var t = raw?.Trim();
        if (string.IsNullOrEmpty(t)) return null;
        if (!System.Text.RegularExpressions.Regex.IsMatch(t, @"^\d+$")) return null;
        return int.TryParse(t, out _) ? t : null;
    }

    private static string? NullIfEmpty(string? v)
    {
        var t = v?.Trim();
        return string.IsNullOrEmpty(t) ? null : t;
    }

    private static Guid? NullIfEmptyGuid(string? v)
    {
        var t = v?.Trim();
        return string.IsNullOrEmpty(t) ? null :
               Guid.TryParse(t, out var g) ? g : null;
    }

    private static string NormalizeUnit(string? v) =>
        v is "кг" or "м" or "пар" ? v : "пар";
}
