namespace Blameja.FiscalBridge.Models;

public sealed record DeleteArticleRequest
{
    public bool ConfirmProgramming { get; init; }
    public int Plu { get; init; }
}
