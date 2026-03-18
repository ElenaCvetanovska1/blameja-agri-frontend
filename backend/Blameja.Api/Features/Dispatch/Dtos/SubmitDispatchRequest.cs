namespace Blameja.Api.Features.Dispatch.Dtos;

public sealed record SubmitDispatchRequest(
    string                  DocNo,
    string                  DocDate,
    decimal                 Total,
    string?                 Note,
    List<DispatchItemDto>   Items);

public sealed record DispatchItemDto(
    string  ProductId,    // Guid as string (matches frontend)
    decimal Qty,
    decimal Cena,         // base price
    decimal ProdaznaCena, // final/sell price
    string  Naziv);       // name (for error messages)

public sealed class DispatchReceiptDto
{
    public Guid Id        { get; init; }
    public int  ReceiptNo { get; init; }
}
