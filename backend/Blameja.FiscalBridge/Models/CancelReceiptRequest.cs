namespace Blameja.FiscalBridge.Models;

// Aborts an in-progress (half-open) fiscal receipt via CANCEL_FISCAL_RECEIPT (0x3C), no payload.
// Recovery command — matches the Java pre-clean that forces the device out of a stuck open-receipt
// state. Does not fiscalize anything; it discards the open receipt.
public sealed record CancelReceiptRequest
{
    public bool ConfirmPrint { get; init; }
}
