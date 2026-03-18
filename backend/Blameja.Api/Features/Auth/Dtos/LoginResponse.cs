namespace Blameja.Api.Features.Auth.Dtos;

public sealed record LoginResponse(
    string AccessToken,
    string RefreshToken,
    long   ExpiresIn,
    string TokenType);
