namespace Blameja.FiscalBridge.Models;

public sealed record DevTestReceiptResponse(
    FiscalRealCommandResponse? OpenResult,
    FiscalRealCommandResponse? SaleResult,
    FiscalRealCommandResponse? PaymentResult,
    FiscalRealCommandResponse? CloseResult,
    bool OverallSuccess,
    long ElapsedMs);
