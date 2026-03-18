using Blameja.Api.Infrastructure.Database;

var builder = WebApplication.CreateBuilder(args);

// ── Database ──────────────────────────────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException(
        "Connection string 'Postgres' is missing. " +
        "Add it to appsettings.Development.json under ConnectionStrings:Postgres.");

builder.Services.AddSingleton(new DbConnectionFactory(connectionString));

// ── Controllers ───────────────────────────────────────────────────────────────
builder.Services.AddControllers();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allows the frontend dev server (Vite, default port 5173) to call this API.
// Adjust origins before deploying to production.
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(
                "http://localhost:5173",  // Vite dev server
                "http://localhost:3000")  // optional: react-router-serve preview
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// ─────────────────────────────────────────────────────────────────────────────

var app = builder.Build();

app.UseCors("frontend");
app.UseAuthorization();
app.MapControllers();

app.Run();
