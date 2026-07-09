namespace Blameja.FiscalBridge.Models;

public sealed record FiscalDryRunResponse(
    bool Success,
    bool DryRun,
    DateTimeOffset GeneratedAt,
    IReadOnlyList<FiscalCommandPacketDto> Commands,
    IReadOnlyList<string> Warnings);
