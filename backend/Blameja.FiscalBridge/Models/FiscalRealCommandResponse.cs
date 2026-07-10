namespace Blameja.FiscalBridge.Models;

public sealed record FiscalRealCommandResponse(
    bool Success,
    bool DryRun,
    string CommandName,
    int CommandIdDecimal,
    string CommandIdHex,
    int? Sequence,
    string ComPort,
    int BaudRate,
    string RequestHex,
    IReadOnlyList<int> RequestBytes,
    string ResponseHex,
    IReadOnlyList<int> ResponseBytes,
    string ResponseStatus,
    string DataHex,
    IReadOnlyList<int> DataBytes,
    string StatusHex,
    IReadOnlyList<int> StatusBytes,
    long ElapsedMs,
    string? Message,
    string? Error,
    DateTimeOffset ExecutedAt);
