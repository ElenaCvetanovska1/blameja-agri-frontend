namespace Blameja.Api.Features.Stock.Dtos;

public sealed record DeactivateProductRequest(bool ClearCodes = true);
