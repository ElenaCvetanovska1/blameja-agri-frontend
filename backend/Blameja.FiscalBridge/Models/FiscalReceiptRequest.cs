namespace Blameja.FiscalBridge.Models;

public sealed record FiscalReceiptRequest
{
    public string? ReceiptId { get; init; }
    public string? Payment { get; init; }
    public decimal Total { get; init; }
    public decimal? CashReceived { get; init; }
    public IReadOnlyList<FiscalReceiptItemDto> Items { get; init; } = [];
}
