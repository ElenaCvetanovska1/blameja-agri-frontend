namespace Blameja.Api.Features.FiscalReceipts.Dtos;

/// <summary>
/// Ad-hoc (manual) storno — a void receipt for an original that is NOT in the database
/// (e.g. printed manually on the register). No original_fiscal_receipt_id link.
/// The FiscalBridge void receipt is executed by the frontend; the result is passed here.
/// </summary>
public sealed record ManualStornoRequestDto(
    List<ManualStornoItemDto> Items,
    string   Payment,        // "CASH" | "CARD"
    string   FiscalStatus,   // "success" | "failed" | "offline"
    int?     FiscalSlipNo,
    string?  FiscalError,
    string?  BridgeResponse,
    int?     StoreNo);

public sealed record ManualStornoItemDto(
    Guid?    ProductId,
    string   ProductName,
    decimal  Quantity,
    decimal  UnitPrice,
    int      TaxGroup,       // fiscal code 1-4
    decimal? TaxPercent,
    bool     IsMacedonian,
    string?  Plu,
    string?  Unit);
