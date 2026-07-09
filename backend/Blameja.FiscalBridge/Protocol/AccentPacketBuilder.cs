namespace Blameja.FiscalBridge.Protocol;

public sealed class AccentPacketBuilder(AccentSequenceGenerator sequenceGenerator)
{
    public AccentPacket Build(string commandName, byte commandId, string? payloadText)
    {
        var payloadBytes = AccentProtocol.EncodePayload(payloadText);
        var sequence = sequenceGenerator.Next();
        var packetBytes = BuildPacketBytes(commandId, sequence, payloadBytes);

        return new AccentPacket(
            commandName,
            commandId,
            sequence,
            payloadText,
            payloadBytes,
            packetBytes);
    }

    private static byte[] BuildPacketBytes(byte commandId, byte sequence, IReadOnlyCollection<byte> payloadBytes)
    {
        var length = 36 + payloadBytes.Count;
        var checksum = length + sequence + commandId + payloadBytes.Sum(b => b) + 5;

        var bytes = new List<byte>(payloadBytes.Count + 10)
        {
            0x01,
            (byte)length,
            sequence,
            commandId
        };

        bytes.AddRange(payloadBytes);
        bytes.Add(0x05);
        bytes.Add((byte)(((checksum / 256) / 16) + 48));
        bytes.Add((byte)(((checksum / 256) % 16) + 48));
        bytes.Add((byte)(((checksum % 256) / 16) + 48));
        bytes.Add((byte)(((checksum % 256) % 16) + 48));
        bytes.Add(0x03);

        return [.. bytes];
    }
}
