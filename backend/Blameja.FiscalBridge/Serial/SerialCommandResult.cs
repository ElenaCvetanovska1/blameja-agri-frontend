using Blameja.FiscalBridge.Protocol;

namespace Blameja.FiscalBridge.Serial;

public sealed record SerialCommandResult(
    AccentResponseStatus ResponseStatus,
    byte[] ResponseBytes,
    long ElapsedMs,
    string? Error);
