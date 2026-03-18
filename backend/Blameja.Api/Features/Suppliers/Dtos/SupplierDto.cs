namespace Blameja.Api.Features.Suppliers.Dtos;

/// <summary>Matches SupplierRow from useSupplierChoices.ts</summary>
public sealed class SupplierDto
{
    public string  Id      { get; init; } = string.Empty;
    public string  Name    { get; init; } = string.Empty;
    public string? Address { get; init; }
}

public sealed record UpdateSupplierAddressRequest(string Address);

public sealed record GetOrCreateSupplierRequest(string Name, string? Address);
