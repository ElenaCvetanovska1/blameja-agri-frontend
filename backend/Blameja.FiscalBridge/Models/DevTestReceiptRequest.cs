namespace Blameja.FiscalBridge.Models;

public sealed record DevTestReceiptRequest
{
    public bool ConfirmPrint { get; init; }
    public string? Description { get; init; }
    public decimal Price { get; init; }
    public decimal Quantity { get; init; } = 1;
    public string? VatGroup { get; init; }
    public bool MacedonianItem { get; init; }
    public string? PaymentMethod { get; init; }
    public decimal PaymentAmount { get; init; }
}
