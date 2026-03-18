namespace Blameja.Api.Features.Finance.Dtos;

/// <summary>Matches DailySalesRow from useDailySales.ts</summary>
public sealed class DailySalesDto
{
    public string  Day           { get; init; } = string.Empty;
    public int     ReceiptsCount { get; init; }
    public decimal Total         { get; init; }
}
