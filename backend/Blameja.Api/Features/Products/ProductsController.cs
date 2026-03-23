using Blameja.Api.Infrastructure.Database;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.Products;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(DbConnectionFactory db) : ControllerBase
{
    /// <summary>
    /// GET /api/products
    /// Optional query params: ?storeNo=20&search=text&limit=100
    ///
    /// Reads from the same product_stock view the frontend uses via Supabase.
    /// Returns an empty array if nothing matches — never 404.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetProducts(
        [FromQuery] int? storeNo,
        [FromQuery] string? search,
        [FromQuery] int limit = 100)
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
                is_macedonian
            FROM product_stock
            WHERE
                (@storeNo IS NULL OR store_no = @storeNo)
                AND (
                    @search IS NULL
                    OR name ILIKE '%' || @search || '%'
                    OR plu ILIKE '%' || @search || '%'
                    OR barcode ILIKE '%' || @search || '%'
                )
            ORDER BY name
            LIMIT @limit;
            """;

        using var conn = db.CreateConnection();
        var rows = await conn.QueryAsync<ProductDto>(sql, new { storeNo, search, limit });
        return Ok(rows);
    }
}
