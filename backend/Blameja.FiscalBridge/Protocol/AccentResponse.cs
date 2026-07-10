namespace Blameja.FiscalBridge.Protocol;

public sealed record AccentResponse(
    AccentResponseStatus ResponseStatus,
    byte[] ResponseBytes,
    byte[] DataBytes,
    byte[] StatusBytes,
    string? Error);
