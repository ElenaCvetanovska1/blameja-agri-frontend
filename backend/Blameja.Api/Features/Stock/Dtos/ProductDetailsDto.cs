namespace Blameja.Api.Features.Stock.Dtos;

public sealed class ProductDetailsDto
{
    public Guid    Id           { get; init; }
    public string  Name         { get; init; } = string.Empty;
    public string? Barcode      { get; init; }
    public string? Plu          { get; init; }
    public decimal SellingPrice { get; init; }
    public Guid?   CategoryId   { get; init; }
    public string  Unit         { get; init; } = "пар";
}
