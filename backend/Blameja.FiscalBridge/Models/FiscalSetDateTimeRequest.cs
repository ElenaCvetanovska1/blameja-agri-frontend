namespace Blameja.FiscalBridge.Models;

public sealed record FiscalSetDateTimeRequest
{
    public DateTime? DateTime { get; init; }
    public string? DateTimeText { get; init; }
}
