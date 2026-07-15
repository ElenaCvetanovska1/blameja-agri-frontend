namespace Blameja.FiscalBridge.Models;

// Fiscal-memory report from date to date. On this CASH REGISTER both the short and detailed variants
// use command DETAILED_FM_REPORT_DATE (0x5E); the leading flag field selects them:
//   short    -> "0\t<from dd-MM-yy>\t<to dd-MM-yy>\t"
//   detailed -> "1\t<from dd-MM-yy>\t<to dd-MM-yy>\t"
public sealed record FmReportRequest
{
    // Period start/end dates. Accepts any parseable date (e.g. "2026-07-01"); formatted to dd-MM-yy.
    public string? From { get; init; }
    public string? To { get; init; }

    // false = short (flag 0), true = detailed (flag 1).
    public bool Detailed { get; init; }

    public bool ConfirmPrint { get; init; }
}
