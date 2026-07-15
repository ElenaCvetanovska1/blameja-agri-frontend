namespace Blameja.FiscalBridge.Models;

public sealed record StornoResponse(
    FiscalRealCommandResponse? OpenResult,
    IReadOnlyList<FiscalRealCommandResponse> SaleResults,
    FiscalRealCommandResponse? PaymentResult,
    FiscalRealCommandResponse? CloseResult,
    bool OverallSuccess,
    long ElapsedMs);
