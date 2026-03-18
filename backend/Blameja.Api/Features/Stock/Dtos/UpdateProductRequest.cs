namespace Blameja.Api.Features.Stock.Dtos;

public sealed record UpdateProductRequest(
    string  Name,
    string? Plu,
    string? Barcode,
    decimal SellingPrice,
    Guid?   CategoryId,
    string  Unit);
