namespace Blameja.Api.Features.Receive.Dtos;

/// <summary>Matches StockLookupRow from useStockLookup.ts</summary>
public sealed class StockLookupDto
{
    public Guid    ProductId    { get; init; }
    public string? Plu          { get; init; }
    public string? Barcode      { get; init; }
    public string? Name         { get; init; }
    public decimal? SellingPrice { get; init; }
    public string? CategoryName { get; init; }
    public decimal? QtyOnHand   { get; init; }
}
