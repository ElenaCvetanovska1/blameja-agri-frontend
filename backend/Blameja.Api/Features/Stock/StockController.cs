using Blameja.Api.Features.Stock.Dtos;
using Blameja.Api.Infrastructure.Database;
using Blameja.Api.Middleware;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.Stock;

/// <summary>
/// Inventory management: stock list, product details, categories, adjustments.
/// Replaces all direct Supabase calls from:
///   useStock.ts, useCategories.ts, useProductDetails.ts,
///   useAdjustStockMutation.ts, useUpdateProductMutation.ts, useDeactivateProductMutation.ts
/// </summary>
[ApiController]
[Route("api")]
[Authorize]
public sealed class StockController(DbConnectionFactory db) : ControllerBase
{
    // ── GET /api/stock ─────────────────────────────────────────────────────
    /// <summary>Paginated inventory list with optional search. Replaces useStock.ts</summary>
    [HttpGet("stock")]
    public async Task<IActionResult> GetStock(
        [FromQuery] string? q,
        CancellationToken   ct)
    {
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
                last_movement_at
            FROM product_stock
            WHERE (
                @q IS NULL
                OR name    ILIKE '%' || @q || '%'
                OR plu     ILIKE '%' || @q || '%'
                OR barcode ILIKE '%' || @q || '%'
            )
            ORDER BY name ASC;
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<StockRowDto>(sql, new { q = string.IsNullOrWhiteSpace(q) ? null : q });
        return Ok(rows);
    }

    // ── GET /api/stock/{productId} ─────────────────────────────────────────
    /// <summary>Single product details. Replaces useProductDetails.ts</summary>
    [HttpGet("stock/{productId:guid}")]
    public async Task<IActionResult> GetProductDetails(Guid productId, CancellationToken ct)
    {
        const string sql = """
            SELECT id, name, barcode, plu, selling_price, category_id, unit
            FROM products
            WHERE id = @productId;
            """;

        using var conn = db.CreateConnection();
        var product = await conn.QuerySingleOrDefaultAsync<ProductDetailsDto>(sql, new { productId });

        if (product is null)
            throw new ApiException("Производот не е пронајден.", StatusCodes.Status404NotFound);

        return Ok(product);
    }

    // ── GET /api/categories ────────────────────────────────────────────────
    /// <summary>Flat category list. Replaces useCategories.ts, useCategoryOptions.ts</summary>
    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories(CancellationToken ct)
    {
        const string sql = "SELECT id, name, code FROM categories ORDER BY name ASC;";

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<CategoryDto>(sql);
        return Ok(rows);
    }

    // ── GET /api/categories/tree ───────────────────────────────────────────
    /// <summary>Category + subcategory tree. Replaces useCategoryTree.ts</summary>
    [HttpGet("categories/tree")]
    public async Task<IActionResult> GetCategoryTree(CancellationToken ct)
    {
        const string catSql  = "SELECT id, code, name FROM categories ORDER BY name ASC;";
        const string subSql  = "SELECT id, category_id, code, name FROM subcategories ORDER BY name ASC;";

        using var conn = db.CreateConnection();

        var cats = (await conn.QueryAsync<CategoryDto>(catSql)).ToList();
        var subs = (await conn.QueryAsync<SubcategoryDto>(subSql)).ToList();

        var byCat = subs.GroupBy(s => s.CategoryId)
                        .ToDictionary(g => g.Key, g => g.ToList());

        var tree = cats.Select(c => new CategoryNodeDto
        {
            Id            = c.Id,
            Name          = c.Name,
            Code          = c.Code,
            Subcategories = byCat.TryGetValue(c.Id, out var s) ? s : [],
        });

        return Ok(tree);
    }

    // ── PUT /api/products/{id} ─────────────────────────────────────────────
    /// <summary>Update product master data. Replaces useUpdateProductMutation.ts</summary>
    [HttpPut("products/{productId:guid}")]
    public async Task<IActionResult> UpdateProduct(
        Guid                 productId,
        [FromBody] UpdateProductRequest request,
        CancellationToken    ct)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name))
            throw new ApiException("Името е задолжително.");

        if (request.SellingPrice < 0)
            throw new ApiException("Продажната цена мора да биде >= 0.");

        var plu     = NullIfEmpty(request.Plu);
        var barcode = NullIfEmpty(request.Barcode);
        var unit    = NormalizeUnit(request.Unit);

        const string sql = """
            UPDATE products
            SET    name          = @name,
                   plu           = @plu,
                   barcode       = @barcode,
                   selling_price = @sellingPrice,
                   category_id   = @categoryId,
                   unit          = @unit,
                   updated_at    = NOW()
            WHERE  id = @productId;
            """;

        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(sql, new
        {
            productId,
            name,
            plu,
            barcode,
            sellingPrice = request.SellingPrice,
            categoryId   = request.CategoryId,
            unit,
        });

        return NoContent();
    }

    // ── POST /api/products/{id}/deactivate ─────────────────────────────────
    /// <summary>Soft-delete a product. Replaces useDeactivateProductMutation.ts</summary>
    [HttpPost("products/{productId:guid}/deactivate")]
    public async Task<IActionResult> DeactivateProduct(
        Guid productId,
        [FromBody] DeactivateProductRequest request,
        CancellationToken ct)
    {
        // When clearCodes=true (default): null out barcode + plu so the product
        // won't appear in future searches — matches existing frontend behaviour.
        const string sql = """
            UPDATE products
            SET    is_active   = false,
                   barcode     = CASE WHEN @clearCodes THEN NULL ELSE barcode END,
                   plu         = CASE WHEN @clearCodes THEN NULL ELSE plu     END,
                   updated_at  = NOW()
            WHERE  id = @productId;
            """;

        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(sql, new { productId, clearCodes = request.ClearCodes });
        return NoContent();
    }

    // ── POST /api/stock/adjust ─────────────────────────────────────────────
    /// <summary>
    /// Manual stock adjustment: creates a stock_movements ADJUST record.
    /// User ID is extracted from the validated JWT — never trusted from the request body.
    /// Replaces useAdjustStockMutation.ts
    /// </summary>
    [HttpPost("stock/adjust")]
    public async Task<IActionResult> AdjustStock(
        [FromBody] AdjustStockRequest request,
        CancellationToken ct)
    {
        if (request.TargetQty < 0)
            throw new ApiException("Новата залиха мора да биде >= 0.");

        using var conn = db.CreateConnection();

        const string currentQtySql = """
            SELECT qty_on_hand FROM product_stock WHERE product_id = @productId;
            """;
        var currentQty = await conn.ExecuteScalarAsync<decimal?>(currentQtySql, new { productId = request.ProductId });
        if (currentQty is null)
            throw new ApiException("Производот не е пронајден.", StatusCodes.Status404NotFound);

        var delta = request.TargetQty - currentQty.Value;
        if (Math.Abs(delta) < 0.0000001m)
            return NoContent();

        var reason = request.Reason?.Trim();
        if (string.IsNullOrEmpty(reason))
            throw new ApiException("Причината е задолжителна.");

        var direction = delta > 0 ? "PLUS" : "MINUS";
        var qty = Math.Abs(delta);

        const string itemSql = """
            INSERT INTO stock_movement_items
                (movement_id, product_id, qty, adjust_direction, unit_cost, unit_price)
            VALUES
                (@movementId, @productId, @qty, @direction::adjust_direction, @unitCost, @unitPrice);
            """;

        // Extract user ID from the Supabase JWT "sub" claim — server-side only
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;

        const string movSql = """
            INSERT INTO stock_movements (type, note, created_by)
            VALUES ('ADJUST', @reason, @userId::uuid)
            RETURNING id;
            """;

      

        var movementId = await conn.ExecuteScalarAsync<Guid>(movSql, new { reason, userId });

        await conn.ExecuteAsync(itemSql, new
        {
            movementId,
            productId  = request.ProductId,
            qty,
            direction,
            unitCost   = request.UnitCost,
            unitPrice  = request.UnitPrice,
        });

        return NoContent();
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private static string? NullIfEmpty(string? v)
    {
        var t = v?.Trim();
        return string.IsNullOrEmpty(t) ? null : t;
    }

    private static string NormalizeUnit(string? v) =>
        v is "кг" or "м" or "пар" ? v : "пар";
}
