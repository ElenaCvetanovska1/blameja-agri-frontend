namespace Blameja.Api.Features.Dispatch.Dtos;

/// <summary>Matches ProductSuggestion from dispatch/types.ts</summary>
public sealed class DispatchProductDto
{
    public Guid    Id           { get; init; }
    public string? Plu          { get; init; }
    public string? Barcode      { get; init; }
    public string  Name         { get; init; } = string.Empty;
    public string  Unit         { get; init; } = "пар";
    public decimal SellingPrice { get; init; }
}
