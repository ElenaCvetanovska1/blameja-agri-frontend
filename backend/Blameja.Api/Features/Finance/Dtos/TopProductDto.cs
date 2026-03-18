namespace Blameja.Api.Features.Finance.Dtos;

/// <summary>Matches TopProductRow from useTopProducts.ts</summary>
public sealed class TopProductDto
{
    public Guid    ProductId { get; init; }
    public string? Plu       { get; init; }
    public string  Name      { get; init; } = string.Empty;
    public decimal Qty       { get; init; }
    public decimal Revenue   { get; init; }
}
