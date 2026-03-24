using System.Text.Json;
using Blameja.Api.Infrastructure.Database;
using Blameja.Api.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

// ── Dapper global config ───────────────────────────────────────────────────
// Maps snake_case PostgreSQL columns (e.g. product_id) to PascalCase C# properties (ProductId)
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ──────────────────────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException(
        "Connection string 'Postgres' is missing. " +
        "Add it to appsettings.Development.json under ConnectionStrings:Postgres.");

var supabaseUrl = builder.Configuration["Supabase:Url"]
    ?? throw new InvalidOperationException("Supabase:Url is missing from configuration.");

var supabaseAnonKey = builder.Configuration["Supabase:AnonKey"]
    ?? throw new InvalidOperationException("Supabase:AnonKey is missing from configuration.");

var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

// ── Infrastructure ─────────────────────────────────────────────────────────
// Singleton: connection factory is stateless — one instance is fine
builder.Services.AddSingleton(new DbConnectionFactory(connectionString));

// Named HttpClient for proxying Supabase Auth REST calls
// Singleton lifetime managed by IHttpClientFactory internally
builder.Services.AddHttpClient("supabase-auth", client =>
{
    client.BaseAddress = new Uri(supabaseUrl.TrimEnd('/') + "/auth/v1/");
    client.DefaultRequestHeaders.Add("apikey", supabaseAnonKey);
});

// ── Authentication — validate Supabase-issued JWTs ─────────────────────────
// Supabase signs user JWTs with ECC P-256 (ES256). Public keys are discovered
// automatically via the OIDC metadata endpoint and refreshed on rotation.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MetadataAddress      = $"{supabaseUrl}/auth/v1/.well-known/openid-configuration";
        options.RequireHttpsMetadata = true;
        options.MapInboundClaims     = false; // keep "sub" as "sub", not mapped to ClaimTypes.NameIdentifier
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer           = true,
            ValidIssuer              = $"{supabaseUrl}/auth/v1",
            ValidateAudience         = false,   // Supabase audience is "authenticated"
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

// ── Controllers ────────────────────────────────────────────────────────────
builder.Services.AddControllers();

// ── JSON: use snake_case globally ──────────────────────────────────────────
// This allows PascalCase C# properties to serialize as product_id, qty_on_hand, etc.
// The frontend type definitions remain unchanged.
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
    options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
});

// ── CORS ───────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// ─────────────────────────────────────────────────────────────────────────
var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
