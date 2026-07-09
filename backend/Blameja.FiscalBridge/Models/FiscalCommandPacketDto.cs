namespace Blameja.FiscalBridge.Models;

public sealed record FiscalCommandPacketDto(
    string CommandName,
    int CommandIdDecimal,
    string CommandIdHex,
    int Sequence,
    string? PayloadText,
    string PayloadHex,
    string PacketHex,
    IReadOnlyList<int> PacketBytes);
