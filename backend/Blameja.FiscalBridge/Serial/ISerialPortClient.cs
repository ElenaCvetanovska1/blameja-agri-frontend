namespace Blameja.FiscalBridge.Serial;

public interface ISerialPortClient
{
    Task<SerialCommandResult> SendAsync(byte[] requestBytes, CancellationToken cancellationToken);
    IReadOnlyList<string> GetPortNames();
}
