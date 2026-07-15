namespace Blameja.FiscalBridge.Protocol;

public static class AccentCommandIds
{
    public const byte GetStatusBytes = 0x4A;
    public const byte GetDiagnosticInformation = 0x5A;
    public const byte OpenFiscalReceipt = 0x30;
    public const byte RegisterSale = 0x31;
    public const byte CalculateTotal = 0x35;
    public const byte CloseFiscalReceipt = 0x38;
    public const byte CancelFiscalReceipt = 0x3C;
    public const byte OpenVoidReceipt = 0x55;
    public const byte CloseVoidReceipt = 0x56;
    public const byte DailyFinancialReport = 0x45;
    public const byte ShortFmReportDate = 0x4F;
    public const byte DetailedFmReportDate = 0x5E;
    public const byte GetDateTime = 0x3E;
    public const byte SetDateTime = 0x3D;
    public const byte PrintDuplicate = 0x6D;

    public static IReadOnlyList<string> SupportedCommandNames { get; } =
    [
        "GET_STATUS_BYTES",
        "GET_DIAGNOSTIC_INFORMATION",
        "OPEN_FISCAL_RECEIPT",
        "REGISTER_SALE",
        "CALCULATE_TOTAL",
        "CLOSE_FISCAL_RECEIPT",
        "CANCEL_FISCAL_RECEIPT",
        "OPEN_VOID_RECEIPT",
        "CLOSE_VOID_RECEIPT",
        "DAILY_FINANCIAL_REPORT",
        "SHORT_FM_REPORT_DATE",
        "DETAILED_FM_REPORT_DATE",
        "GET_DATE_TIME",
        "SET_DATE_TIME",
        "PRINT_DUPLICATE"
    ];
}
