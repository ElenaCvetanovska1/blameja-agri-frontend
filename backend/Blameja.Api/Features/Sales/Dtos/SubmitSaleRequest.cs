namespace Blameja.Api.Features.Sales.Dtos;

public sealed record SubmitSaleRequest(
    string              Payment,       // "CASH" | "CARD"
    decimal             Total,
    decimal?            CashReceived,  // null for CARD
    string?             Note,
    List<SaleItemDto>   Items);

public sealed record SaleItemDto(
    Guid    ProductId,
    decimal Qty,
    decimal BasePrice,
    decimal Price,
    decimal Discount);
