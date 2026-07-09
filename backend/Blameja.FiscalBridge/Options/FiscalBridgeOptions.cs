namespace Blameja.FiscalBridge.Options;

public sealed class FiscalBridgeOptions
{
    public const string SectionName = "FiscalBridge";

    public string DeviceType { get; init; } = "Printer";
    public string ComPort { get; init; } = "COM3";
    public int BaudRate { get; init; } = 9600;
    public bool DryRun { get; init; } = true;
}
