namespace Blameja.FiscalBridge.Models;

public sealed record ReceiptCloseRequest
{
    public bool ConfirmPrint { get; init; }
}
