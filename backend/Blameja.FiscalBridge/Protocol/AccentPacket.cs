namespace Blameja.FiscalBridge.Protocol;

public sealed record AccentPacket(
    string CommandName,
    byte CommandId,
    byte Sequence,
    string? PayloadText,
    byte[] PayloadBytes,
    byte[] PacketBytes);
