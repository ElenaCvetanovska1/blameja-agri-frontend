namespace Blameja.Api.Features.FiscalReceipts.Dtos;

/// <summary>
/// One line item from fiscal_receipt_items for the receipt detail view.
/// Later used as the basis for STORNO item selection.
/// </summary>
public sealed class FiscalReceiptItemDto
{
    public Guid     Id               { get; init; }
    public Guid     FiscalReceiptId  { get; init; }
    public Guid?    SalesItemId      { get; init; }
    public Guid?    ProductId        { get; init; }
    public string?  Plu              { get; init; }
    public int?     FiscalPlu        { get; init; }
    public string?  ProductName      { get; init; }
    public decimal  Quantity         { get; init; }
    public decimal  UnitPrice        { get; init; }
    public decimal  LineTotal        { get; init; }
    public decimal  Discount         { get; init; }
    public decimal  BasePrice        { get; init; }
    public int?     TaxGroup         { get; init; }
    public decimal? TaxPercent       { get; init; }
    public bool     IsMacedonian     { get; init; }
    public string?  Unit             { get; init; }
    public string?  Barcode                        { get; init; }
    public DateTime CreatedAt                      { get; init; }
    public Guid?    OriginalFiscalReceiptItemId    { get; init; }
    /// <summary>
    /// Remaining returnable quantity = original quantity minus already-storno'd quantity.
    /// Only meaningful for items on 'sale' receipts. Always 0 for storno items.
    /// </summary>
    public decimal  RemainingQty                   { get; init; }
}
