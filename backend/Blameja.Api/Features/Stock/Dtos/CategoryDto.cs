namespace Blameja.Api.Features.Stock.Dtos;

public sealed class CategoryDto
{
    public Guid    Id   { get; init; }
    public string  Name { get; init; } = string.Empty;
    public string? Code { get; init; }
}

public sealed class SubcategoryDto
{
    public Guid   Id         { get; init; }
    public Guid   CategoryId { get; init; }
    public string Name       { get; init; } = string.Empty;
    public string? Code      { get; init; }
}

public sealed class CategoryNodeDto
{
    public Guid                  Id            { get; init; }
    public string                Name          { get; init; } = string.Empty;
    public string?               Code          { get; init; }
    public List<SubcategoryDto>  Subcategories { get; init; } = [];
}
