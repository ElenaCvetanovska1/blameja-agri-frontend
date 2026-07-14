namespace Blameja.FiscalBridge.Models;

public sealed record CashMovementRequest
{
    public bool ConfirmPrint { get; init; }
    public decimal Amount { get; init; }
    public string? Reason { get; init; }
}
