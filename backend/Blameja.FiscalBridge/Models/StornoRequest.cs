namespace Blameja.FiscalBridge.Models;

// STORNO (void receipt) — Option A, exact port of the Java SDK void-receipt flow:
// OPEN_VOID_RECEIPT (0x55) → REGISTER_SALE (0x31) per line → CALCULATE_TOTAL (0x35) → CLOSE_VOID_RECEIPT (0x56).
// Items and payment are re-entered as POSITIVE values (Java uses the same commands as a normal sale).
// There is intentionally NO reference to the original receipt — the original↔storno link is kept by
// the application/accounting layer, not by the fiscal command (matches Java).
public sealed record StornoRequest
{
    public bool ConfirmPrint { get; init; }
    public IReadOnlyList<StornoItem> Items { get; init; } = [];
    public string? PaymentMethod { get; init; }
    public decimal Amount { get; init; }
    public string? InfoLine1 { get; init; }
    public string? InfoLine2 { get; init; }
}

public sealed record StornoItem
{
    public string? Description { get; init; }
    public string? VatGroup { get; init; }
    public decimal Price { get; init; }
    public decimal Quantity { get; init; } = 1;
    public bool MacedonianItem { get; init; }
    public string? PriceCorrectionType { get; init; } = "NONE";
    public decimal PriceCorrectionValue { get; init; }
}
