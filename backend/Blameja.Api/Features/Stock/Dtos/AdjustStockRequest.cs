namespace Blameja.Api.Features.Stock.Dtos;

public sealed record AdjustStockRequest
{
    public Guid ProductId { get; init; }
    public decimal TargetQty { get; init; }
    public decimal CurrentQty { get; init; }
    public string Reason { get; init; } = string.Empty;
    public decimal UnitCost { get; init; }
    public decimal UnitPrice { get; init; }
}