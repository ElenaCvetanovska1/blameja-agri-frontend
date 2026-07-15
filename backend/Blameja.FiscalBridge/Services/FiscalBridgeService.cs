using System.Globalization;
using Blameja.FiscalBridge.Models;
using Blameja.FiscalBridge.Options;
using Blameja.FiscalBridge.Protocol;
using Blameja.FiscalBridge.Serial;
using Microsoft.Extensions.Options;

namespace Blameja.FiscalBridge.Services;

public sealed class FiscalBridgeService(
    AccentPacketBuilder packetBuilder,
    AccentResponseParser responseParser,
    ISerialPortClient serialPortClient,
    IOptions<FiscalBridgeOptions> options,
    ILogger<FiscalBridgeService> logger) : IFiscalBridgeService
{
    private const string PrintConfirmationHeaderValue = "I_UNDERSTAND_THIS_PRINTS_A_REAL_FISCAL_RECEIPT";
    private const byte SetAndReadItemsCommandId = 0x6B;
    private const byte CashInOutCommandId = 0x46;
    private readonly FiscalBridgeOptions _options = options.Value;

    public FiscalHealthResponse GetHealth()
    {
        return new FiscalHealthResponse(
            Success: true,
            DryRun: _options.DryRun,
            DeviceType: _options.DeviceType,
            ComPort: _options.ComPort,
            BaudRate: _options.BaudRate,
            SupportedCommands: AccentCommandIds.SupportedCommandNames);
    }

    public FiscalDryRunResponse BuildStatusDryRun()
    {
        return DryRun([Build("GET_STATUS_BYTES", AccentCommandIds.GetStatusBytes, null)]);
    }

    public FiscalDryRunResponse BuildDiagnosticDryRun()
    {
        return DryRun([Build("GET_DIAGNOSTIC_INFORMATION", AccentCommandIds.GetDiagnosticInformation, "1")]);
    }

    public FiscalDryRunResponse BuildDateTimeDryRun()
    {
        return DryRun([Build("GET_DATE_TIME", AccentCommandIds.GetDateTime, null)]);
    }

    public FiscalDryRunResponse BuildReceiptDryRun(FiscalReceiptRequest request)
    {
        var warnings = new List<string>();
        var commands = new List<FiscalCommandPacketDto>
        {
            Build("OPEN_FISCAL_RECEIPT", AccentCommandIds.OpenFiscalReceipt, "1\t1\t\t0\t")
        };

        foreach (var item in request.Items)
        {
            commands.Add(Build("REGISTER_SALE", AccentCommandIds.RegisterSale, BuildRegisterSalePayload(item, warnings)));
        }

        var payment = ParsePayment(request.Payment);
        var amount = request.CashReceived.GetValueOrDefault(request.Total);
        var paymentPayload = string.Concat(ToCashRegisterPaymentType(payment), "\t", AccentProtocol.FormatPrice(amount), "\t");

        commands.Add(Build("CALCULATE_TOTAL", AccentCommandIds.CalculateTotal, paymentPayload));
        commands.Add(Build("CLOSE_FISCAL_RECEIPT", AccentCommandIds.CloseFiscalReceipt, null));

        return DryRun(commands, warnings);
    }

    public FiscalDryRunResponse BuildCancelReceiptDryRun()
    {
        return DryRun([Build("CANCEL_FISCAL_RECEIPT", AccentCommandIds.CancelFiscalReceipt, null)]);
    }

    public FiscalDryRunResponse BuildZReportDryRun()
    {
        return DryRun([Build("DAILY_FINANCIAL_REPORT", AccentCommandIds.DailyFinancialReport, "1")]);
    }

    public FiscalDryRunResponse BuildSetDateTimeDryRun(FiscalSetDateTimeRequest? request)
    {
        var dateTime = ResolveDateTime(request);
        var payload = dateTime.ToString("dd-MM-yy HH:mm:ss", CultureInfo.InvariantCulture);

        return DryRun([Build("SET_DATE_TIME", AccentCommandIds.SetDateTime, payload)]);
    }

    public Task<FiscalRealCommandResponse> ExecuteStatusAsync(CancellationToken cancellationToken)
    {
        return ExecuteReadOnlyCommandAsync("GET_STATUS_BYTES", AccentCommandIds.GetStatusBytes, null, cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteDiagnosticAsync(CancellationToken cancellationToken)
    {
        return ExecuteReadOnlyCommandAsync("GET_DIAGNOSTIC_INFORMATION", AccentCommandIds.GetDiagnosticInformation, "1", cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteDateTimeAsync(CancellationToken cancellationToken)
    {
        return ExecuteReadOnlyCommandAsync("GET_DATE_TIME", AccentCommandIds.GetDateTime, null, cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteOpenFiscalReceiptAsync(
        ReceiptOpenRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        // CASH REGISTER: open always uses OPEN_FISCAL_RECEIPT (0x30); the storno/void distinction is a
        // payload flag (4th tab field: 0 = normal, 1 = storno), NOT a separate command id. Mirrors
        // Java OpenFiscalReceipt/OpenVoidReceipt CASH_REGISTER branch ("1\t1\t\t0\t" / "1\t1\t\t1\t").
        const byte commandId = AccentCommandIds.OpenFiscalReceipt;
        var commandName = request.Storno ? "OPEN_FISCAL_RECEIPT(void)" : "OPEN_FISCAL_RECEIPT";
        var payload = request.Storno ? "1\t1\t\t1\t" : "1\t1\t\t0\t";

        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            request.ConfirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to open a real fiscal receipt.");
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(commandName, commandId, payload, cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteRegisterSaleAsync(
        ReceiptSaleRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "REGISTER_SALE";
        const byte commandId = AccentCommandIds.RegisterSale;

        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            request.ConfirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to register a real fiscal sale.");
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(commandName, commandId, BuildRegisterSalePayload(request), cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteReceiptPaymentAsync(
        ReceiptPaymentRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "CALCULATE_TOTAL";
        const byte commandId = AccentCommandIds.CalculateTotal;

        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            request.ConfirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to calculate a real fiscal receipt payment.");
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(commandName, commandId, BuildReceiptPaymentPayload(request), cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteCloseFiscalReceiptAsync(
        ReceiptCloseRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        // CASH REGISTER: close always uses CLOSE_FISCAL_RECEIPT (0x38), no payload, for both normal and
        // storno receipts — the void was established by the open flag. (The 0x56 void-close is printer-only.)
        const byte commandId = AccentCommandIds.CloseFiscalReceipt;
        var commandName = request.Storno ? "CLOSE_FISCAL_RECEIPT(void)" : "CLOSE_FISCAL_RECEIPT";

        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            request.ConfirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to close a real fiscal receipt.");
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(commandName, commandId, null, cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteCancelReceiptAsync(
        CancelReceiptRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "CANCEL_FISCAL_RECEIPT";
        const byte commandId = AccentCommandIds.CancelFiscalReceipt;

        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            request.ConfirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to cancel a real fiscal receipt.");
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(commandName, commandId, null, cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteRawCommandAsync(
        byte commandId,
        string commandName,
        string? payloadText,
        bool confirmPrint,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            confirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to send a real raw command.");
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(commandName, commandId, payloadText, cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteCashInAsync(
        CashMovementRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        return ExecuteCashMovementAsync(
            request,
            "IN",
            request.Amount,
            printConfirmationHeader,
            cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteCashOutAsync(
        CashMovementRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        return ExecuteCashMovementAsync(
            request,
            "OUT",
            -request.Amount,
            printConfirmationHeader,
            cancellationToken);
    }

    public async Task<FiscalRealCommandResponse> ExecuteXReportAsync(
        XReportRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "DAILY_FINANCIAL_REPORT";
        const byte commandId = AccentCommandIds.DailyFinancialReport;

        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            request.ConfirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to print a real X report.");
        if (blockedResponse is not null)
        {
            LogXReportCommand(blockedResponse);
            return blockedResponse;
        }

        var response = await ExecuteReadOnlyCommandAsync(
            commandName,
            commandId,
            BuildDailyReportPayload(DailyClosureReportOptionEnum.REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS),
            cancellationToken);

        LogXReportCommand(response);
        return response;
    }

    public async Task<FiscalRealCommandResponse> ExecuteZReportAsync(
        ZReportRequest request,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "DAILY_FINANCIAL_REPORT";
        const byte commandId = AccentCommandIds.DailyFinancialReport;

        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            request.ConfirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to print a real Z report.");
        if (blockedResponse is not null)
        {
            LogZReportCommand(blockedResponse);
            return blockedResponse;
        }

        var response = await ExecuteReadOnlyCommandAsync(
            commandName,
            commandId,
            BuildDailyReportPayload(DailyClosureReportOptionEnum.FISCAL_CLOSURE_WITH_REGISTERS),
            cancellationToken);

        LogZReportCommand(response);
        return response;
    }

    public async Task<FiscalRealCommandResponse> ExecuteFmDateReportAsync(
        DateTime fromDate,
        DateTime toDate,
        bool detailed,
        bool confirmPrint,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        // CASH REGISTER: both short and detailed date-range FM reports use DETAILED_FM_REPORT_DATE
        // (0x5E); the leading flag selects short ("0") vs detailed ("1"). Payload:
        //   <flag>\t<from dd-MM-yy>\t<to dd-MM-yy>\t   — mirrors Java Short/DetailPeriodReport.
        const string commandName = "DETAILED_FM_REPORT_DATE";
        const byte commandId = AccentCommandIds.DetailedFmReportDate;

        var blockedResponse = ValidatePrintExecution(
            commandName,
            commandId,
            confirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to print a real fiscal-memory report.");
        if (blockedResponse is not null)
        {
            LogFmReportCommand(blockedResponse);
            return blockedResponse;
        }

        var flag = detailed ? "1" : "0";
        var payload = string.Concat(
            flag, "\t",
            fromDate.ToString("dd-MM-yy", CultureInfo.InvariantCulture), "\t",
            toDate.ToString("dd-MM-yy", CultureInfo.InvariantCulture), "\t");

        var response = await ExecuteReadOnlyCommandAsync(commandName, commandId, payload, cancellationToken);

        LogFmReportCommand(response);
        return response;
    }

    private void LogFmReportCommand(FiscalRealCommandResponse response)
    {
        logger.LogInformation(
            "FM date report command completed. Command={Command} RequestHex={RequestHex} ResponseHex={ResponseHex} ElapsedMs={ElapsedMs}",
            response.CommandName,
            response.RequestHex,
            response.ResponseHex,
            response.ElapsedMs);
    }

    public Task<FiscalRealCommandResponse> ExecuteProgramArticleAsync(
        ProgramArticleRequest request,
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "ProgramArticle";

        var blockedResponse = ValidateProgrammingExecution(
            commandName,
            SetAndReadItemsCommandId,
            request.ConfirmProgramming,
            programmingConfirmationHeader,
            "Set confirmProgramming=true in the request body to program a real fiscal article.");
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(
            commandName,
            SetAndReadItemsCommandId,
            BuildProgramArticlePayload(request),
            cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteReadArticleAsync(
        int plu,
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "ReadArticle";

        var blockedResponse = ValidateProgrammingExecution(
            commandName,
            SetAndReadItemsCommandId,
            true,
            programmingConfirmationHeader,
            string.Empty);
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(commandName, SetAndReadItemsCommandId, $"R\t{plu}\t", cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteFindFirstProgrammedArticleAsync(
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken)
    {
        return ExecuteArticleReadCommandAsync(
            "FindFirstProgrammedArticle",
            BuildFindFirstProgrammedArticlePayload(),
            programmingConfirmationHeader,
            cancellationToken);
    }

    public Task<FiscalRealCommandResponse> ExecuteFindNextProgrammedArticleAsync(
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken)
    {
        return ExecuteArticleReadCommandAsync(
            "FindNextProgrammedArticle",
            BuildFindNextProgrammedArticlePayload(),
            programmingConfirmationHeader,
            cancellationToken);
    }

    public async Task<FiscalRealCommandResponse> ExecuteDeleteArticleAsync(
        DeleteArticleRequest request,
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "DeleteArticles";

        var blockedResponse = ValidateProgrammingExecution(
            commandName,
            SetAndReadItemsCommandId,
            request.ConfirmProgramming,
            programmingConfirmationHeader,
            "Set confirmProgramming=true in the request body to delete a real fiscal article.");
        if (blockedResponse is not null)
        {
            LogDeleteArticleCommand(blockedResponse, request.Plu);
            return blockedResponse;
        }

        var response = await ExecuteReadOnlyCommandAsync(
            commandName,
            SetAndReadItemsCommandId,
            BuildDeleteArticlePayload(request.Plu),
            cancellationToken);

        LogDeleteArticleCommand(response, request.Plu);
        return response;
    }

    public IReadOnlyList<string> GetAvailablePorts()
    {
        return serialPortClient.GetPortNames();
    }

    private FiscalCommandPacketDto Build(string commandName, byte commandId, string? payloadText)
    {
        var packet = packetBuilder.Build(commandName, commandId, payloadText);

        return new FiscalCommandPacketDto(
            CommandName: packet.CommandName,
            CommandIdDecimal: packet.CommandId,
            CommandIdHex: $"0x{packet.CommandId:X2}",
            Sequence: packet.Sequence,
            PayloadText: packet.PayloadText,
            PayloadHex: AccentProtocol.ToHex(packet.PayloadBytes),
            PacketHex: AccentProtocol.ToHex(packet.PacketBytes),
            PacketBytes: packet.PacketBytes.Select(b => (int)b).ToArray());
    }

    private FiscalDryRunResponse DryRun(IReadOnlyList<FiscalCommandPacketDto> commands, IReadOnlyList<string>? warnings = null)
    {
        return new FiscalDryRunResponse(
            Success: true,
            DryRun: true,
            GeneratedAt: DateTimeOffset.UtcNow,
            Commands: commands,
            Warnings: warnings ?? []);
    }

    private async Task<FiscalRealCommandResponse> ExecuteReadOnlyCommandAsync(
        string commandName,
        byte commandId,
        string? payloadText,
        CancellationToken cancellationToken)
    {
        if (!_options.RealSerialEnabled)
        {
            return DisabledRealSerialResponse(commandName, commandId);
        }

        var packet = packetBuilder.Build(commandName, commandId, payloadText);
        var requestHex = AccentProtocol.ToHex(packet.PacketBytes);

        logger.LogInformation(
            "Sending fiscal command {CommandName} to {ComPort}. RequestHex={RequestHex}",
            commandName,
            _options.ComPort,
            requestHex);

        var serialResult = await serialPortClient.SendAsync(packet.PacketBytes, cancellationToken);
        var response = responseParser.Parse(commandId, serialResult);
        var responseLength = GetResponseByte(response.ResponseBytes, 1);
        var responseSequence = GetResponseByte(response.ResponseBytes, 2);
        var responseCommandId = GetResponseByte(response.ResponseBytes, 3);
        var expectedCommandIdHex = $"0x{commandId:X2}";

        logger.LogInformation(
            "Fiscal command {CommandName} completed on {ComPort}. ResponseStatus={ResponseStatus} ResponseHex={ResponseHex}",
            commandName,
            _options.ComPort,
            response.ResponseStatus,
            AccentProtocol.ToHex(response.ResponseBytes));

        if (!string.IsNullOrWhiteSpace(response.Error))
        {
            logger.LogWarning(
                "Fiscal command {CommandName} on {ComPort} returned error: {Error}",
                commandName,
                _options.ComPort,
                response.Error);
        }

        return new FiscalRealCommandResponse(
            Success: response.ResponseStatus == AccentResponseStatus.OK,
            DryRun: false,
            CommandName: packet.CommandName,
            CommandIdDecimal: packet.CommandId,
            CommandIdHex: $"0x{packet.CommandId:X2}",
            Sequence: packet.Sequence,
            ComPort: _options.ComPort,
            BaudRate: _options.BaudRate,
            RequestHex: requestHex,
            RequestBytes: packet.PacketBytes.Select(b => (int)b).ToArray(),
            ResponseHex: AccentProtocol.ToHex(response.ResponseBytes),
            ResponseBytes: response.ResponseBytes.Select(b => (int)b).ToArray(),
            ResponseLength: responseLength,
            ResponseSequence: responseSequence,
            ResponseCommandIdDecimal: responseCommandId,
            ResponseCommandIdHex: FormatHex(responseCommandId),
            ExpectedCommandIdHex: expectedCommandIdHex,
            IsCommandIdMatch: responseCommandId is null ? null : responseCommandId.Value == commandId,
            IsSequenceMatch: responseSequence is null ? null : responseSequence.Value == packet.Sequence,
            ResponseStatus: response.ResponseStatus.ToString(),
            DataHex: AccentProtocol.ToHex(response.DataBytes),
            DataBytes: response.DataBytes.Select(b => (int)b).ToArray(),
            DataText: DecodeDataText(response.DataBytes),
            StatusHex: AccentProtocol.ToHex(response.StatusBytes),
            StatusBytes: response.StatusBytes.Select(b => (int)b).ToArray(),
            ElapsedMs: serialResult.ElapsedMs,
            Message: response.Error,
            Error: response.Error,
            ExecutedAt: DateTimeOffset.UtcNow);
    }

    private FiscalRealCommandResponse DisabledRealSerialResponse(string commandName, byte commandId)
    {
        const string message = "Set FiscalBridge:RealSerialEnabled=true to use COM port.";

        return new FiscalRealCommandResponse(
            Success: false,
            DryRun: false,
            CommandName: commandName,
            CommandIdDecimal: commandId,
            CommandIdHex: $"0x{commandId:X2}",
            Sequence: null,
            ComPort: _options.ComPort,
            BaudRate: _options.BaudRate,
            RequestHex: string.Empty,
            RequestBytes: [],
            ResponseHex: string.Empty,
            ResponseBytes: [],
            ResponseLength: null,
            ResponseSequence: null,
            ResponseCommandIdDecimal: null,
            ResponseCommandIdHex: null,
            ExpectedCommandIdHex: $"0x{commandId:X2}",
            IsCommandIdMatch: null,
            IsSequenceMatch: null,
            ResponseStatus: "REAL_SERIAL_DISABLED",
            DataHex: string.Empty,
            DataBytes: [],
            DataText: string.Empty,
            StatusHex: string.Empty,
            StatusBytes: [],
            ElapsedMs: 0,
            Message: message,
            Error: message,
            ExecutedAt: DateTimeOffset.UtcNow);
    }

    private FiscalRealCommandResponse? ValidatePrintExecution(
        string commandName,
        byte commandId,
        bool confirmPrint,
        string? printConfirmationHeader,
        string confirmPrintMessage)
    {
        if (!_options.RealSerialEnabled)
        {
            return DisabledRealSerialResponse(commandName, commandId);
        }

        if (!_options.AllowReceiptPrinting)
        {
            return BlockedCommandResponse(
                commandName,
                commandId,
                "RECEIPT_PRINTING_DISABLED",
                "Set FiscalBridge:AllowReceiptPrinting=true to allow real fiscal receipt printing.");
        }

        if (!confirmPrint)
        {
            return BlockedCommandResponse(
                commandName,
                commandId,
                "PRINT_NOT_CONFIRMED",
                confirmPrintMessage);
        }

        if (!string.Equals(printConfirmationHeader, PrintConfirmationHeaderValue, StringComparison.Ordinal))
        {
            return BlockedCommandResponse(
                commandName,
                commandId,
                "PRINT_CONFIRMATION_HEADER_MISSING",
                $"Set X-Fiscal-Print-Confirmation to {PrintConfirmationHeaderValue}.");
        }

        return null;
    }

    private FiscalRealCommandResponse? ValidateProgrammingExecution(
        string commandName,
        byte commandId,
        bool confirmProgramming,
        string? programmingConfirmationHeader,
        string confirmProgrammingMessage)
    {
        if (!_options.RealSerialEnabled)
        {
            return DisabledRealSerialResponse(commandName, commandId);
        }

        if (!confirmProgramming)
        {
            return BlockedCommandResponse(
                commandName,
                commandId,
                "PROGRAMMING_NOT_CONFIRMED",
                confirmProgrammingMessage);
        }

        if (!string.Equals(programmingConfirmationHeader, PrintConfirmationHeaderValue, StringComparison.Ordinal))
        {
            return BlockedCommandResponse(
                commandName,
                commandId,
                "PROGRAMMING_CONFIRMATION_HEADER_MISSING",
                $"Set X-Fiscal-Print-Confirmation to {PrintConfirmationHeaderValue}.");
        }

        return null;
    }

    private Task<FiscalRealCommandResponse> ExecuteArticleReadCommandAsync(
        string commandName,
        string payload,
        string? programmingConfirmationHeader,
        CancellationToken cancellationToken)
    {
        var blockedResponse = ValidateProgrammingExecution(
            commandName,
            SetAndReadItemsCommandId,
            true,
            programmingConfirmationHeader,
            string.Empty);
        if (blockedResponse is not null)
        {
            return Task.FromResult(blockedResponse);
        }

        return ExecuteReadOnlyCommandAsync(commandName, SetAndReadItemsCommandId, payload, cancellationToken);
    }

    private void LogXReportCommand(FiscalRealCommandResponse response)
    {
        logger.LogInformation(
            "X report command completed. Command={Command} RequestHex={RequestHex} ResponseHex={ResponseHex} ElapsedMs={ElapsedMs}",
            response.CommandName,
            response.RequestHex,
            response.ResponseHex,
            response.ElapsedMs);
    }

    private void LogZReportCommand(FiscalRealCommandResponse response)
    {
        logger.LogInformation(
            "Z report command completed. Command={Command} RequestHex={RequestHex} ResponseHex={ResponseHex} ElapsedMs={ElapsedMs}",
            response.CommandName,
            response.RequestHex,
            response.ResponseHex,
            response.ElapsedMs);
    }

    private async Task<FiscalRealCommandResponse> ExecuteCashMovementAsync(
        CashMovementRequest request,
        string movementType,
        decimal signedAmount,
        string? printConfirmationHeader,
        CancellationToken cancellationToken)
    {
        const string commandName = "CASH_IN_OUT";

        var blockedResponse = ValidatePrintExecution(
            commandName,
            CashInOutCommandId,
            request.ConfirmPrint,
            printConfirmationHeader,
            "Set confirmPrint=true in the request body to perform a real cash movement.");
        if (blockedResponse is not null)
        {
            LogCashMovementCommand(blockedResponse, movementType, request.Amount);
            return blockedResponse;
        }

        var response = await ExecuteReadOnlyCommandAsync(
            commandName,
            CashInOutCommandId,
            BuildCashInOutPayload(signedAmount),
            cancellationToken);

        LogCashMovementCommand(response, movementType, request.Amount);
        return response;
    }

    private void LogCashMovementCommand(FiscalRealCommandResponse response, string movementType, decimal amount)
    {
        logger.LogInformation(
            "Cash movement command completed. Command={Command} MovementType={MovementType} Amount={Amount} RequestHex={RequestHex} ResponseHex={ResponseHex} ElapsedMs={ElapsedMs}",
            response.CommandName,
            movementType,
            amount,
            response.RequestHex,
            response.ResponseHex,
            response.ElapsedMs);
    }

    private void LogDeleteArticleCommand(FiscalRealCommandResponse response, int plu)
    {
        logger.LogInformation(
            "Article delete command completed. Command={Command} PLU={Plu} RequestHex={RequestHex} ResponseHex={ResponseHex} ElapsedMs={ElapsedMs}",
            response.CommandName,
            plu,
            response.RequestHex,
            response.ResponseHex,
            response.ElapsedMs);
    }

    private FiscalRealCommandResponse BlockedCommandResponse(
        string commandName,
        byte commandId,
        string responseStatus,
        string message)
    {
        return new FiscalRealCommandResponse(
            Success: false,
            DryRun: false,
            CommandName: commandName,
            CommandIdDecimal: commandId,
            CommandIdHex: $"0x{commandId:X2}",
            Sequence: null,
            ComPort: _options.ComPort,
            BaudRate: _options.BaudRate,
            RequestHex: string.Empty,
            RequestBytes: [],
            ResponseHex: string.Empty,
            ResponseBytes: [],
            ResponseLength: null,
            ResponseSequence: null,
            ResponseCommandIdDecimal: null,
            ResponseCommandIdHex: null,
            ExpectedCommandIdHex: $"0x{commandId:X2}",
            IsCommandIdMatch: null,
            IsSequenceMatch: null,
            ResponseStatus: responseStatus,
            DataHex: string.Empty,
            DataBytes: [],
            DataText: string.Empty,
            StatusHex: string.Empty,
            StatusBytes: [],
            ElapsedMs: 0,
            Message: message,
            Error: message,
            ExecutedAt: DateTimeOffset.UtcNow);
    }

    private static int? GetResponseByte(IReadOnlyList<byte> responseBytes, int index)
    {
        return responseBytes.Count > index ? responseBytes[index] : null;
    }

    private static string? FormatHex(int? value)
    {
        return value is null ? null : $"0x{value.Value:X2}";
    }

    private static string DecodeDataText(byte[] dataBytes)
    {
        return dataBytes.Length == 0 ? string.Empty : AccentProtocol.Cp1251.GetString(dataBytes);
    }

    private static string BuildRegisterSalePayload(FiscalReceiptItemDto item, ICollection<string> warnings)
    {
        // CASH REGISTER item line (see BuildRegisterSalePayload(ReceiptSaleRequest) for the format).
        _ = warnings;
        var description = TranslateToCyrillicLikeJava((item.ProductName ?? string.Empty).ToUpper(CultureInfo.CurrentCulture));
        var taxGroup = ToCashRegisterVatGroup(ParseVatGroup(item.VatGroup));
        var macFlag = item.IsMacedonian ? "1" : "0";

        return string.Concat(
            description, "\t",
            taxGroup, "\t",
            AccentProtocol.FormatPrice(item.UnitPrice), "\t",
            AccentProtocol.FormatQuantity(item.Quantity), "\t",
            macFlag, "\t\t\t");
    }

    private static string BuildRegisterSalePayload(ReceiptSaleRequest request)
    {
        // CASH REGISTER item line, mirrors Java ReceiptItem.toIntList():
        //   DESC(UPPER,cyrillic) \t taxGroupNum \t price(0.00) \t quantity(0.000) \t macFlag \t <corrType> \t <corrValue(0.00)> \t
        // A price correction (discount/surcharge) is emitted ONLY when a type is set AND the value is
        // non-zero; otherwise the correction-type/value fields are empty (two trailing tabs).
        var description = TranslateToCyrillicLikeJava(request.Description!.ToUpper(CultureInfo.CurrentCulture));
        var taxGroup = ToCashRegisterVatGroup(ParseVatGroup(request.VatGroup));
        var macFlag = request.MacedonianItem ? "1" : "0";
        var correctionType = ParsePriceCorrectionType(request.PriceCorrectionType);

        var line = string.Concat(
            description, "\t",
            taxGroup, "\t",
            AccentProtocol.FormatPrice(request.Price), "\t",
            AccentProtocol.FormatQuantity(request.Quantity), "\t",
            macFlag, "\t");

        if (correctionType is not AccentPriceCorrectionType.None && request.PriceCorrectionValue != 0m)
        {
            return string.Concat(
                line,
                ToCashRegisterCorrectionType(correctionType), "\t",
                AccentProtocol.FormatPrice(request.PriceCorrectionValue), "\t");
        }

        return string.Concat(line, "\t\t");
    }

    private static string ToCashRegisterCorrectionType(AccentPriceCorrectionType type)
    {
        // Java ReceiptItem CASH_REGISTER correction-type numbers.
        return type switch
        {
            AccentPriceCorrectionType.SurchargePercent => "1",
            AccentPriceCorrectionType.DiscountPercent => "2",
            AccentPriceCorrectionType.SurchargeValue => "3",
            AccentPriceCorrectionType.DiscountValue => "4",
            _ => throw new ArgumentOutOfRangeException(nameof(type), type, null)
        };
    }

    private static string BuildReceiptPaymentPayload(ReceiptPaymentRequest request)
    {
        // CASH REGISTER payment, mirrors Java PaymentMethod.toIntList():
        //   payTypeNumber \t amount(0.00 when > 0, else empty) \t
        var payType = ToCashRegisterPaymentType(ParseOptionalPayment(request.PaymentMethod));
        var amount = request.Amount > 0 ? AccentProtocol.FormatPrice(request.Amount) : string.Empty;

        return string.Concat(payType, "\t", amount, "\t");
    }

    private static string ToCashRegisterPaymentType(AccentPaymentMethod? paymentMethod)
    {
        // Java PaymentMethod CASH_REGISTER branch: DEBIT -> "1", CREDIT -> "2"; CASH/CHECK/unset -> "0".
        return paymentMethod switch
        {
            AccentPaymentMethod.Debit => "1",
            AccentPaymentMethod.Credit => "2",
            _ => "0"
        };
    }

    private static string BuildCashInOutPayload(decimal signedAmount)
    {
        var type = signedAmount < 0 ? "1" : "0";
        var amount = Math.Abs(signedAmount);

        return string.Concat(type, "\t", AccentProtocol.FormatPrice(amount), "\t");
    }

    // Mirrors the Java DailyClosureReport.toIntList() CASH_REGISTER branch AND is confirmed on the
    // real device: command 0x45 accepts ONLY the letter+TAB form — "X\t" (0x58 0x09) for any control
    // read-out, "Z\t" (0x5A 0x09) for fiscal closure. Hardware probing proved every other form is
    // rejected: raw digit '2'/'3' and lowercase 'x' → firmware "Bad input" (-1004); a second
    // parameter ("X\t\t", "X\t0\t", ...) → error -12001. Therefore the device exposes exactly one X
    // report (the extended "ПРОШИРЕН КОНТРОЛЕН ИЗВЕШТАЈ") via 0x45; there is no separate short
    // "КОНТРОЛЕН ИЗВЕШТАЈ" reachable from the PC over this command — it is a device-keypad function.
    private static string BuildDailyReportPayload(DailyClosureReportOptionEnum option)
    {
        var isFiscalClosure =
            option is DailyClosureReportOptionEnum.FISCAL_CLOSURE_WITH_REGISTERS
                   or DailyClosureReportOptionEnum.FISCAL_CLOSURE_WO_REGISTERS;
        return isFiscalClosure ? "Z\t" : "X\t";
    }

    private static string BuildProgramArticlePayload(ProgramArticleRequest request)
    {
        return string.Concat(
            "P\t",
            request.Plu.ToString(CultureInfo.InvariantCulture),
            "\t",
            ToCashRegisterVatGroup(ParseVatGroup(request.VatGroup)),
            "\t",
            request.Department.ToString(CultureInfo.InvariantCulture),
            "\t",
            request.Group.ToString(CultureInfo.InvariantCulture),
            "\t",
            request.PriceType.ToString(CultureInfo.InvariantCulture),
            "\t",
            AccentProtocol.FormatPrice(request.Price),
            "\t",
            string.Empty,
            "\t",
            FormatArticleQuantity(request.Quantity),
            "\t",
            JavaString(request.Barcode1),
            "\t",
            JavaString(request.Barcode2),
            "\t",
            JavaString(request.Barcode3),
            "\t",
            JavaString(request.Barcode4),
            "\t",
            TranslateToCyrillicLikeJava(request.Name!.ToUpper(CultureInfo.CurrentCulture)),
            "\t");
    }

    private static string BuildFindFirstProgrammedArticlePayload()
    {
        return "F\t\t";
    }

    private static string BuildFindNextProgrammedArticlePayload()
    {
        return "N\t";
    }

    private static string BuildDeleteArticlePayload(int plu)
    {
        var pluText = plu.ToString(CultureInfo.InvariantCulture);
        return string.Concat("D\t", pluText, "\t", pluText, "\t");
    }

    private static string ToCashRegisterVatGroup(AccentVatGroup vatGroup)
    {
        return vatGroup switch
        {
            AccentVatGroup.A => "1",
            AccentVatGroup.B => "2",
            AccentVatGroup.V => "3",
            AccentVatGroup.G => "4",
            _ => throw new ArgumentOutOfRangeException(nameof(vatGroup), vatGroup, null)
        };
    }

    private static string FormatArticleQuantity(decimal value)
    {
        return value.ToString("0.00", CultureInfo.InvariantCulture);
    }

    private static string JavaString(string? value)
    {
        return value ?? "null";
    }

    private static string TranslateToCyrillicLikeJava(string value)
    {
        var chars = value.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = TranslateToCyrillicLikeJava(chars[i]);
        }

        return new string(chars);
    }

    private static char TranslateToCyrillicLikeJava(char value)
    {
        return value switch
        {
            'q' => (char)1113,
            'w' => (char)1114,
            'e' => (char)1077,
            'r' => (char)1088,
            't' => (char)1090,
            'y' => (char)1109,
            'u' => (char)1091,
            'i' => (char)1080,
            'o' => (char)1086,
            'p' => (char)1087,
            '[' => (char)1096,
            ']' => (char)1107,
            'a' => (char)1072,
            's' => (char)1089,
            'd' => (char)1076,
            'f' => (char)1092,
            'g' => (char)1075,
            'h' => (char)1093,
            'j' => (char)1112,
            'k' => (char)1082,
            'l' => (char)1083,
            ';' => (char)1095,
            '\'' => (char)1116,
            '\\' => (char)1078,
            'z' => (char)1079,
            'x' => (char)1119,
            'c' => (char)1094,
            'v' => (char)1074,
            'b' => (char)1073,
            'n' => (char)1085,
            'm' => (char)1084,
            'Q' => (char)1033,
            'W' => (char)1034,
            'E' => (char)1045,
            'R' => (char)1056,
            'T' => (char)1058,
            'Y' => (char)1029,
            'U' => (char)1059,
            'I' => (char)1048,
            'O' => (char)1054,
            'P' => (char)1055,
            '{' => (char)1064,
            '}' => (char)1027,
            'A' => (char)1040,
            'S' => (char)1057,
            'D' => (char)1044,
            'F' => (char)1060,
            'G' => (char)1043,
            'H' => (char)1061,
            'J' => (char)1032,
            'K' => (char)1050,
            'L' => (char)1051,
            ':' => (char)1063,
            '"' => (char)1036,
            '|' => (char)1046,
            'Z' => (char)1047,
            'X' => (char)1039,
            'C' => (char)1062,
            'V' => (char)1042,
            'B' => (char)1041,
            'N' => (char)1053,
            'M' => (char)1052,
            _ => value
        };
    }

    private static string FormatPrinterDescription(string? productName, ICollection<string> warnings)
    {
        var description = (productName ?? string.Empty).Trim();
        if (description.Length <= 20)
        {
            return description;
        }

        warnings.Add($"Product description '{description}' was split/truncated for printer payload.");

        // Java uses two 19-character chunks separated by LF for printer descriptions longer than 20 chars.
        var first = description[..Math.Min(19, description.Length)];
        var remaining = description.Length > 19 ? description[19..] : string.Empty;
        var second = remaining[..Math.Min(19, remaining.Length)];

        return string.IsNullOrEmpty(second) ? first : $"{first}\n{second}";
    }

    private static string FormatPrinterDescriptionLikeJava(string description)
    {
        if (description.Length <= 20)
        {
            return description;
        }

        var first = description[..19];
        var remainingEndExclusive = Math.Max(19, description.Length - 1);
        var remaining = description[19..remainingEndExclusive];
        var second = remaining.Length > 20 ? remaining[..19] : remaining;

        return string.IsNullOrEmpty(second) ? first : $"{first}\n{second}";
    }

    private static string FormatPrinterCorrection(AccentPriceCorrectionType correctionType, decimal correctionValue)
    {
        if (correctionType == AccentPriceCorrectionType.None)
        {
            return string.Empty;
        }

        var separator = correctionType is AccentPriceCorrectionType.DiscountValue or AccentPriceCorrectionType.SurchargeValue
            ? ";"
            : ",";
        var sign = correctionType is AccentPriceCorrectionType.SurchargePercent or AccentPriceCorrectionType.SurchargeValue
            ? "+"
            : "-";
        var value = correctionType is AccentPriceCorrectionType.DiscountPercent or AccentPriceCorrectionType.DiscountValue
            ? Math.Abs(correctionValue)
            : correctionValue;

        return string.Concat(separator, sign, AccentProtocol.FormatPrice(value));
    }

    private static DateTime ResolveDateTime(FiscalSetDateTimeRequest? request)
    {
        if (request?.DateTime is { } dateTime)
        {
            return dateTime;
        }

        if (!string.IsNullOrWhiteSpace(request?.DateTimeText)
            && DateTime.TryParse(request.DateTimeText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed))
        {
            return parsed;
        }

        return DateTime.Now;
    }

    private static AccentVatGroup ParseVatGroup(string? vatGroup)
    {
        return vatGroup?.Trim().ToUpperInvariant() switch
        {
            "A" => AccentVatGroup.A,
            "B" => AccentVatGroup.B,
            "V" => AccentVatGroup.V,
            "G" => AccentVatGroup.G,
            _ => throw new InvalidOperationException("Invalid VAT group.")
        };
    }

    private static AccentPaymentMethod ParsePayment(string? payment)
    {
        return payment?.Trim().ToUpperInvariant() switch
        {
            "CASH" => AccentPaymentMethod.Cash,
            "CREDIT" => AccentPaymentMethod.Credit,
            "CHECK" => AccentPaymentMethod.Check,
            "DEBIT" => AccentPaymentMethod.Debit,
            _ => throw new InvalidOperationException("Invalid payment method.")
        };
    }

    private static AccentPaymentMethod? ParseOptionalPayment(string? payment)
    {
        return string.IsNullOrWhiteSpace(payment)
            ? null
            : ParsePayment(payment);
    }

    private static AccentPriceCorrectionType ParsePriceCorrectionType(string? correctionType)
    {
        return correctionType?.Trim().ToUpperInvariant() switch
        {
            null or "" or "NONE" => AccentPriceCorrectionType.None,
            "DISCOUNT_VALUE" => AccentPriceCorrectionType.DiscountValue,
            "DISCOUNT_PERCENT" => AccentPriceCorrectionType.DiscountPercent,
            "SURCHARGE_VALUE" => AccentPriceCorrectionType.SurchargeValue,
            "SURCHARGE_PERCENT" => AccentPriceCorrectionType.SurchargePercent,
            _ => throw new InvalidOperationException("Invalid price correction type.")
        };
    }

    private enum DailyClosureReportOptionEnum
    {
        FISCAL_CLOSURE_WO_REGISTERS = 48,
        FISCAL_CLOSURE_WITH_REGISTERS = 49,
        REPORT_WO_FISCAL_CLOSURE_WO_REGISTERS = 50,
        REPORT_WO_FISCAL_CLOSURE_WITH_REGISTERS = 51
    }
}
