namespace Blameja.FiscalBridge.Models;

public sealed record ProgramArticleRequest
{
    public bool ConfirmProgramming { get; init; }
    public int Plu { get; init; }
    public string? Name { get; init; }
    public decimal Price { get; init; }
    public string? VatGroup { get; init; }
    public int Department { get; init; } = 1;
    public int Group { get; init; } = 1;
    public int PriceType { get; init; } = 3;
    public decimal Quantity { get; init; }
    public string Barcode1 { get; init; } = "0";
    public string Barcode2 { get; init; } = "0";
    public string Barcode3 { get; init; } = "0";
    public string Barcode4 { get; init; } = "0";
}
