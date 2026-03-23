namespace Blameja.Api.Features.Sales.Dtos;

public sealed record UpdateFiscalRequest(
    int?     FiscalSlipNo,
    string   FiscalStatus,   // "success" | "failed" | "offline"
    string?  FiscalError,
    DateTime FiscalSyncedAt);
