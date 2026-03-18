namespace Blameja.Api.Features.Receive.Dtos;

/// <summary>
/// Matches ProductLookup from useProductLookup.ts.
/// Uses init-only properties (not a positional record) so Dapper can map it
/// via the parameterless constructor, and `with` expressions still work.
/// </summary>
public sealed record ProductLookupDto
{
    public Guid    Id            { get; init; }
    public string? Plu           { get; init; }
    public string? Barcode       { get; init; }
    public string  Name          { get; init; } = string.Empty;
    public string? Description   { get; init; }
    public string  Unit          { get; init; } = "пар";
    public decimal SellingPrice  { get; init; }
    public int?    TaxGroup      { get; init; }
    public Guid?   CategoryId    { get; init; }
    public Guid?   SubcategoryId { get; init; }
}
