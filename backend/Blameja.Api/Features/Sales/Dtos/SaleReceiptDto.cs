namespace Blameja.Api.Features.Sales.Dtos;

public sealed class SaleReceiptDto
{
    public Guid      Id           { get; init; }
    public int       ReceiptNo    { get; init; }
    public string    Payment      { get; init; } = string.Empty;
    public decimal   Total        { get; init; }
    public decimal?  CashReceived { get; init; }
    public DateTime  CreatedAt    { get; init; }
}
