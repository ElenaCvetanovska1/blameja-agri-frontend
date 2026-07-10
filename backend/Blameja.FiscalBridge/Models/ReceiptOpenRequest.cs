namespace Blameja.FiscalBridge.Models;

public sealed record ReceiptOpenRequest
{
    public bool ConfirmPrint { get; init; }
    public int OperatorCode { get; init; } = 1;
    public string OperatorPassword { get; init; } = "0000";
    public bool Storno { get; init; }
}
