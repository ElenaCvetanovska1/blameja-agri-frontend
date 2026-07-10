namespace Blameja.FiscalBridge.Options;

public sealed class FiscalBridgeOptions
{
    public const string SectionName = "FiscalBridge";

    public string DeviceType { get; init; } = "Printer";
    public string ComPort { get; init; } = "COM3";
    public int BaudRate { get; init; } = 9600;
    public bool DryRun { get; init; } = true;
    public bool RealSerialEnabled { get; init; }
    public int DataBits { get; init; } = 8;
    public string Parity { get; init; } = "None";
    public string StopBits { get; init; } = "One";
    public string Handshake { get; init; } = "None";
    public int ReadTimeoutMs { get; init; } = 1000;
    public int WriteTimeoutMs { get; init; } = 1000;
    public int OverallReadTimeoutMs { get; init; } = 3000;
}
