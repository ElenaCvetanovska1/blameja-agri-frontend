namespace Blameja.Api.Features.FiscalReceipts.Dtos;

/// <summary>
/// Full fiscal receipt header for the detail view.
/// Returned together with FiscalReceiptItemDto list as { receipt, items }.
/// </summary>
public sealed class FiscalReceiptDetailDto
{
    public Guid     Id              { get; init; }
    public Guid?    SalesReceiptId  { get; init; }
    public string?  ReceiptType     { get; init; }
    public int?     FiscalSlipNo    { get; init; }
    public string?  FiscalStatus    { get; init; }
    public string?  FiscalError     { get; init; }
    public int?     StoreNo         { get; init; }
    public string?  Payment         { get; init; }
    public decimal  Total           { get; init; }
    public decimal? CashReceived    { get; init; }
    public decimal? PaidAmount      { get; init; }
    public decimal? ChangeAmount    { get; init; }
    public decimal? Subtotal        { get; init; }
    public string?  ExternalDocNo   { get; init; }
    public string?  CreatedBy       { get; init; }
    public string?  BridgeResponse  { get; init; }
    public DateTime? FiscalizedAt   { get; init; }
    public DateTime  CreatedAt      { get; init; }
}
