namespace Blameja.Api.Features.Sales.Dtos;

/// <summary>
/// Product search result from product_stock view.
/// Matches the frontend's ProductStockRow type exactly (snake_case JSON via naming policy).
/// </summary>
public sealed class ProductStockDto
{
    public Guid    ProductId    { get; init; }
    public string? Plu          { get; init; }
    public string? Barcode      { get; init; }
    public string  Name         { get; init; } = string.Empty;
    public decimal SellingPrice { get; init; }
    public decimal QtyOnHand    { get; init; }
    public string? CategoryName { get; init; }
    public int     StoreNo      { get; init; }
    public int?    TaxGroup     { get; init; }
}
