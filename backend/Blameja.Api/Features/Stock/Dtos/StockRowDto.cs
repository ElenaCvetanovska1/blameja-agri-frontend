namespace Blameja.Api.Features.Stock.Dtos;

/// <summary>
/// Matches the product_stock view columns and the frontend's StockRow type.
/// Property names are PascalCase in C# but serialize as snake_case JSON
/// (via JsonNamingPolicy.SnakeCaseLower configured in Program.cs).
/// </summary>
public sealed class StockRowDto
{
    public Guid     ProductId       { get; init; }
    public string?  Plu             { get; init; }
    public string?  Barcode         { get; init; }
    public string   Name            { get; init; } = string.Empty;
    public decimal  SellingPrice    { get; init; }
    public decimal  QtyOnHand       { get; init; }
    public string?  CategoryName    { get; init; }
    public int      StoreNo         { get; init; }
    public int?     TaxGroup        { get; init; }
    public string?  LastMovementAt  { get; init; }
}
