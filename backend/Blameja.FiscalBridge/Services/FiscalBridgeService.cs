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
            Build("OPEN_FISCAL_RECEIPT", AccentCommandIds.OpenFiscalReceipt, "1,0000,1")
        };

        foreach (var item in request.Items)
        {
            commands.Add(Build("REGISTER_SALE", AccentCommandIds.RegisterSale, BuildRegisterSalePayload(item, warnings)));
        }

        var payment = ParsePayment(request.Payment);
        var amount = request.CashReceived.GetValueOrDefault(request.Total);
        var paymentPayload = $"\t{AccentProtocol.ToPaymentChar(payment)}{AccentProtocol.FormatPrice(amount)}";

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
        const string commandName = "OPEN_FISCAL_RECEIPT";
        const byte commandId = AccentCommandIds.OpenFiscalReceipt;
        const string payload = "1,0000,1";

        if (!_options.RealSerialEnabled)
        {
            return Task.FromResult(DisabledRealSerialResponse(commandName, commandId));
        }

        if (!_options.AllowReceiptPrinting)
        {
            return Task.FromResult(BlockedCommandResponse(
                commandName,
                commandId,
                "RECEIPT_PRINTING_DISABLED",
                "Set FiscalBridge:AllowReceiptPrinting=true to allow real fiscal receipt printing."));
        }

        if (!request.ConfirmPrint)
        {
            return Task.FromResult(BlockedCommandResponse(
                commandName,
                commandId,
                "PRINT_NOT_CONFIRMED",
                "Set confirmPrint=true in the request body to open a real fiscal receipt."));
        }

        if (!string.Equals(printConfirmationHeader, PrintConfirmationHeaderValue, StringComparison.Ordinal))
        {
            return Task.FromResult(BlockedCommandResponse(
                commandName,
                commandId,
                "PRINT_CONFIRMATION_HEADER_MISSING",
                $"Set X-Fiscal-Print-Confirmation to {PrintConfirmationHeaderValue}."));
        }

        return ExecuteReadOnlyCommandAsync(commandName, commandId, payload, cancellationToken);
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
        var description = FormatPrinterDescription(item.ProductName, warnings);
        var vatGroup = ParseVatGroup(item.VatGroup);
        var macedonianMarker = item.IsMacedonian ? "@" : string.Empty;

        return string.Concat(
            description,
            "\t",
            macedonianMarker,
            AccentProtocol.ToVatChar(vatGroup),
            AccentProtocol.FormatPrice(item.UnitPrice),
            "*",
            AccentProtocol.FormatQuantity(item.Quantity));
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
}
