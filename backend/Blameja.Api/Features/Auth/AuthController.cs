using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Blameja.Api.Features.Auth.Dtos;
using Blameja.Api.Middleware;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Features.Auth;

/// <summary>
/// Proxies authentication operations to the Supabase Auth REST API.
/// The frontend never talks to Supabase directly — all auth goes through here.
/// JWTs are validated on every subsequent request via JwtBearer middleware.
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(IHttpClientFactory httpClientFactory) : ControllerBase
{
    // ── Login ──────────────────────────────────────────────────────────────
    /// <summary>
    /// POST /api/auth/login
    /// Accepts email + password, delegates to Supabase Auth, returns tokens.
    /// The frontend stores access_token and refresh_token in localStorage.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("supabase-auth");

        var body = JsonSerializer.Serialize(new
        {
            email    = request.Email,
            password = request.Password,
        });

        using var content = new StringContent(body, Encoding.UTF8, "application/json");

        var res = await client.PostAsync("token?grant_type=password", content, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
        {
            // Supabase returns e.g. {"error":"invalid_grant","error_description":"Invalid login credentials"}
            var err = TryExtractErrorDescription(raw);
            throw new ApiException(err ?? "Погрешен email или лозинка.", StatusCodes.Status401Unauthorized);
        }

        var parsed = JsonSerializer.Deserialize<SupabaseTokenResponse>(raw,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (parsed?.AccessToken is null)
            throw new ApiException("Неуспешна автентикација.", StatusCodes.Status401Unauthorized);

        return Ok(new LoginResponse(
            parsed.AccessToken,
            parsed.RefreshToken ?? string.Empty,
            parsed.ExpiresIn,
            parsed.TokenType ?? "bearer"));
    }

    // ── Refresh ────────────────────────────────────────────────────────────
    /// <summary>
    /// POST /api/auth/refresh
    /// Exchange a refresh_token for a new access_token.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("supabase-auth");

        var body = JsonSerializer.Serialize(new { refresh_token = request.RefreshToken });
        using var content = new StringContent(body, Encoding.UTF8, "application/json");

        var res = await client.PostAsync("token?grant_type=refresh_token", content, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
            throw new ApiException("Сесијата истече. Најавете се повторно.", StatusCodes.Status401Unauthorized);

        var parsed = JsonSerializer.Deserialize<SupabaseTokenResponse>(raw,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (parsed?.AccessToken is null)
            throw new ApiException("Неуспешно обновување на сесијата.", StatusCodes.Status401Unauthorized);

        return Ok(new LoginResponse(
            parsed.AccessToken,
            parsed.RefreshToken ?? string.Empty,
            parsed.ExpiresIn,
            parsed.TokenType ?? "bearer"));
    }

    // ── Logout ─────────────────────────────────────────────────────────────
    /// <summary>
    /// POST /api/auth/logout
    /// Revokes the token on the Supabase side. The frontend clears localStorage.
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var accessToken = ExtractBearerToken();

        if (accessToken is not null)
        {
            try
            {
                var client = httpClientFactory.CreateClient("supabase-auth");
                using var req = new HttpRequestMessage(HttpMethod.Post, "logout");
                req.Headers.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
                await client.SendAsync(req, ct);
            }
            catch
            {
                // Non-blocking: frontend will clear tokens regardless
            }
        }

        return NoContent();
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private string? ExtractBearerToken()
    {
        var auth = Request.Headers.Authorization.FirstOrDefault();
        if (auth is null || !auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;
        return auth["Bearer ".Length..].Trim();
    }

    private static string? TryExtractErrorDescription(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("error_description", out var desc))
                return desc.GetString();
            if (doc.RootElement.TryGetProperty("msg", out var msg))
                return msg.GetString();
        }
        catch { /* ignore */ }
        return null;
    }

    // Internal POCO to deserialize Supabase's token response
    private sealed class SupabaseTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; init; }

        [JsonPropertyName("refresh_token")]
        public string? RefreshToken { get; init; }

        [JsonPropertyName("expires_in")]
        public long ExpiresIn { get; init; }

        [JsonPropertyName("token_type")]
        public string? TokenType { get; init; }
    }
}
