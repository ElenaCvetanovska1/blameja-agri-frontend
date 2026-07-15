namespace Blameja.FiscalBridge.Models;

public sealed record ReceiptCloseRequest
{
    public bool ConfirmPrint { get; init; }

    // When true, closes a void (storno) receipt via CLOSE_VOID_RECEIPT (0x56) instead of the normal
    // CLOSE_FISCAL_RECEIPT (0x38). Must match the open command used to start the receipt.
    public bool Storno { get; init; }
}
