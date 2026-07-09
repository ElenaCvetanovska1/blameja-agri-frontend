namespace Blameja.FiscalBridge.Models;

public sealed record FiscalReceiptItemDto
{
    public string? ProductName { get; init; }
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
    public string? VatGroup { get; init; }
    public bool IsMacedonian { get; init; }
    public string? Plu { get; init; }
    public int? FiscalPlu { get; init; }
    public string? Barcode { get; init; }
}
