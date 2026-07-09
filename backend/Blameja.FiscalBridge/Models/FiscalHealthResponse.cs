namespace Blameja.FiscalBridge.Models;

public sealed record FiscalHealthResponse(
    bool Success,
    bool DryRun,
    string DeviceType,
    string ComPort,
    int BaudRate,
    IReadOnlyList<string> SupportedCommands);
