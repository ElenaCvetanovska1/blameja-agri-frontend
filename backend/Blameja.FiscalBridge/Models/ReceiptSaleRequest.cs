namespace Blameja.FiscalBridge.Models;

public sealed record ReceiptSaleRequest
{
    public bool ConfirmPrint { get; init; }
    public string? Description { get; init; }
    public string? VatGroup { get; init; }
    public decimal Price { get; init; }
    public decimal Quantity { get; init; } = 1;
    public bool MacedonianItem { get; init; }
    public string? PriceCorrectionType { get; init; } = "NONE";
    public decimal PriceCorrectionValue { get; init; }
}
