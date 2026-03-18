namespace Blameja.Api.Features.Receive.Dtos;

/// <summary>Matches the frontend Row type from useProductChoices.ts</summary>
public sealed class ReceiveProductChoiceDto
{
    public Guid    Id           { get; init; }
    public string? Name         { get; init; }
    public string? Plu          { get; init; }
    public string? Barcode      { get; init; }
    public decimal? SellingPrice { get; init; }
    public int?    TaxGroup     { get; init; }
    public Guid?   CategoryId   { get; init; }
    public string? CategoryName { get; init; }
    public string? Unit         { get; init; }
    public int?    StoreNo      { get; init; }
}
