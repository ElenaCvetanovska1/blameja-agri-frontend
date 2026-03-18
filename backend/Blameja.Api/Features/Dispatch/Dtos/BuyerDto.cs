namespace Blameja.Api.Features.Dispatch.Dtos;

/// <summary>Matches BuyerRow from useBuyerChoices.ts / dispatch/types.ts</summary>
public sealed class BuyerDto
{
    public string  Key     { get; init; } = string.Empty;
    public string  Name    { get; init; } = string.Empty;
    public string? Address { get; init; }
    public string  Source  { get; init; } = string.Empty; // "PERSON" | "SUPPLIER"
}
