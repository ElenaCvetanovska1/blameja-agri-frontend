namespace Blameja.FiscalBridge.Models;

// DEV-ONLY: send any command id + payload to the device to probe exact on-wire formats
// (e.g. cash-register vs printer receipt payloads). Gated by the same print protections.
public sealed record RawCommandRequest
{
    // Command id in decimal (e.g. 48 = 0x30 OPEN_FISCAL_RECEIPT) or "0x30" hex string.
    public string CommandId { get; init; } = string.Empty;

    // Literal payload text; JSON "\t" becomes a real TAB (0x09). Null/empty = no payload.
    public string? Payload { get; init; }

    public bool ConfirmPrint { get; init; }
}
