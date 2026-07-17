namespace Blameja.FiscalBridge.Protocol;

public static class AccentCommandIds
{
    public const byte GetStatusBytes = 0x4A;
    public const byte GetDiagnosticInformation = 0x5A;

    // GET_DAILY_SUMS (0x43) — чита ги акумулираните дневни суми (тековен промет) од работната
    // меморија на уредот БЕЗ печатење и БЕЗ фискално затворање. Тоа е „моментална состојба":
    // не е X извештај (0x45 „X\t") и не е Z извештај (0x45 „Z\t"). Companion: GET_DAILY_TAX (0x41)
    // ги дава истите суми разбиени по даночна група. Дефинирани се во Java CommandsEnum, но SDK-то
    // нема команда-класа за нив → чиста read команда без payload (како GET_STATUS_BYTES/GET_DATE_TIME).
    public const byte GetDailySums = 0x43;
    public const byte GetDailyTax = 0x41;
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
    public const byte PaperFeed = 0x2C;
    public const byte CutPaper = 0x2D;
    public const byte GetDateTime = 0x3E;
    public const byte SetDateTime = 0x3D;
    public const byte PrintDuplicate = 0x6D;

    public static IReadOnlyList<string> SupportedCommandNames { get; } =
    [
        "GET_STATUS_BYTES",
        "GET_DIAGNOSTIC_INFORMATION",
        "GET_DAILY_SUMS",
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
        "PAPER_FEED",
        "CUT_PAPER",
        "GET_DATE_TIME",
        "SET_DATE_TIME",
        "PRINT_DUPLICATE"
    ];
}
