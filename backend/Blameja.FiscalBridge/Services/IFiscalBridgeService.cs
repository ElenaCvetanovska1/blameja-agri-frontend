using Blameja.FiscalBridge.Models;

namespace Blameja.FiscalBridge.Services;

public interface IFiscalBridgeService
{
    FiscalHealthResponse GetHealth();
    FiscalDryRunResponse BuildStatusDryRun();
    FiscalDryRunResponse BuildDiagnosticDryRun();
    FiscalDryRunResponse BuildReceiptDryRun(FiscalReceiptRequest request);
    FiscalDryRunResponse BuildCancelReceiptDryRun();
    FiscalDryRunResponse BuildZReportDryRun();
    FiscalDryRunResponse BuildSetDateTimeDryRun(FiscalSetDateTimeRequest? request);
}
