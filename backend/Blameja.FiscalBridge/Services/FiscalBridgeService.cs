using System.Globalization;
using Blameja.FiscalBridge.Models;
using Blameja.FiscalBridge.Options;
using Blameja.FiscalBridge.Protocol;
using Microsoft.Extensions.Options;

namespace Blameja.FiscalBridge.Services;

public sealed class FiscalBridgeService(
    AccentPacketBuilder packetBuilder,
    IOptions<FiscalBridgeOptions> options) : IFiscalBridgeService
{
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
