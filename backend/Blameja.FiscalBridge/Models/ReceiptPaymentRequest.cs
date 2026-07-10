namespace Blameja.FiscalBridge.Models;

public sealed record ReceiptPaymentRequest
{
    public bool ConfirmPrint { get; init; }
    public string? PaymentMethod { get; init; }
    public decimal Amount { get; init; }
    public string? InfoLine1 { get; init; }
    public string? InfoLine2 { get; init; }
}
