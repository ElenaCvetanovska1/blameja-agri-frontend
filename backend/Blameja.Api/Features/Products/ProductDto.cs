namespace Blameja.Api.Features.Products;

/// <summary>
/// Mirrors the product_stock view columns that the frontend currently reads via Supabase.
/// Column names use snake_case to match PostgreSQL column names via Dapper.
/// </summary>
public sealed class ProductDto
{
    public Guid product_id { get; init; }
    public string? plu { get; init; }
    public string? barcode { get; init; }
    public string name { get; init; } = string.Empty;
    public decimal selling_price { get; init; }
    public decimal qty_on_hand { get; init; }
    public string? category_name { get; init; }
    public int store_no { get; init; }
    public string? tax_group { get; init; }
}
