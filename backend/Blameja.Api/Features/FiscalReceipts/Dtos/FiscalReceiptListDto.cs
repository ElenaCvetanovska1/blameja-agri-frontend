namespace Blameja.Api.Features.FiscalReceipts.Dtos;

/// <summary>
/// Summary row for the fiscal receipts archive list (last N days).
/// Serialized as snake_case via the global JsonNamingPolicy.SnakeCaseLower policy.
/// </summary>
public sealed class FiscalReceiptListDto
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
    public string?  ExternalDocNo   { get; init; }
    public string?  CreatedBy       { get; init; }
    public DateTime? FiscalizedAt              { get; init; }
    public DateTime  CreatedAt                 { get; init; }
    public Guid?     OriginalFiscalReceiptId   { get; init; }
}
