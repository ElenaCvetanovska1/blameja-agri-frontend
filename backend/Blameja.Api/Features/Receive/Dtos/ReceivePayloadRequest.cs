namespace Blameja.Api.Features.Receive.Dtos;

public sealed record ReceivePayloadRequest(
    string  Plu,
    string  Name,
    string  CategoryId,
    string  Qty,
    string  Barcode,
    string  SellingPrice,
    string  UnitCost,
    string  Description,
    string  Note,
    string  TaxGroup,        // "5" | "10" | "18"
    string? SupplierId,
    string? Unit,            // "пар" | "кг" | "м"
    int     StoreNo);        // 20 | 30

public sealed record ReceiveResult(Guid ProductId, Guid MovementId);
