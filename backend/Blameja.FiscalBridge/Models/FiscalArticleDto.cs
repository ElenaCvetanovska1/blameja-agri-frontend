namespace Blameja.FiscalBridge.Models;

public sealed record FiscalArticleDto(
    int Plu,
    string Name,
    decimal Price,
    string VatGroup,
    int Department,
    int Group,
    int PriceType,
    decimal Quantity,
    string Barcode1,
    string Barcode2,
    string Barcode3,
    string Barcode4,
    bool Programmed);
