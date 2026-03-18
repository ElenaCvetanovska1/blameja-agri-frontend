namespace Blameja.Api.Features.Sales.Dtos;

public sealed record UpdateFiscalRequest(
    int?     FiscalSlipNo,
    string   FiscalStatus,   // "ok" | "failed" | "offline"
    string?  FiscalError,
    DateTime FiscalSyncedAt);
