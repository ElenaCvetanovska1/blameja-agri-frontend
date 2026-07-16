using Blameja.FiscalBridge.Models;

namespace Blameja.FiscalBridge.Services;

public interface IFiscalBridgeService
{
    FiscalHealthResponse GetHealth();
    FiscalDryRunResponse BuildStatusDryRun();
    FiscalDryRunResponse BuildDiagnosticDryRun();
    FiscalDryRunResponse BuildDateTimeDryRun();
    FiscalDryRunResponse BuildReceiptDryRun(FiscalReceiptRequest request);
    FiscalDryRunResponse BuildCancelReceiptDryRun();
    FiscalDryRunResponse BuildZReportDryRun();
    FiscalDryRunResponse BuildSetDateTimeDryRun(FiscalSetDateTimeRequest? request);
    Task<FiscalRealCommandResponse> ExecuteStatusAsync(CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteDiagnosticAsync(CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteDateTimeAsync(CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteSetDateTimeAsync(
        FiscalSetDateTimeRequest? request,
        string? confirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteOpenFiscalReceiptAsync(
        ReceiptOpenRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteRegisterSaleAsync(
        ReceiptSaleRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteReceiptPaymentAsync(
        ReceiptPaymentRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteCloseFiscalReceiptAsync(
        ReceiptCloseRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteCashInAsync(
        CashMovementRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteCashOutAsync(
        CashMovementRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteXReportAsync(
        XReportRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteCancelReceiptAsync(
        CancelReceiptRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteRawCommandAsync(
        byte commandId,
        string commandName,
        string? payloadText,
        bool confirmPrint,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteZReportAsync(
        ZReportRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteFmDateReportAsync(
        DateTime fromDate,
        DateTime toDate,
        bool detailed,
        bool confirmPrint,
        string? printConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteProgramArticleAsync(
        ProgramArticleRequest request,
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteReadArticleAsync(
        int plu,
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteFindFirstProgrammedArticleAsync(
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteFindNextProgrammedArticleAsync(
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken);
    Task<FiscalRealCommandResponse> ExecuteDeleteArticleAsync(
        DeleteArticleRequest request,
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken);
    IReadOnlyList<string> GetAvailablePorts();
}
