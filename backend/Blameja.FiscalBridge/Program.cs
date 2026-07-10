using System.Text;
using System.Text.Json;
using Blameja.FiscalBridge.Options;
using Blameja.FiscalBridge.Protocol;
using Blameja.FiscalBridge.Serial;
using Blameja.FiscalBridge.Services;

Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

var builder = WebApplication.CreateBuilder(args);

var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services
    .AddOptions<FiscalBridgeOptions>()
    .Bind(builder.Configuration.GetSection(FiscalBridgeOptions.SectionName))
    .Validate(options => options.DryRun, "Phase 1A requires FiscalBridge:DryRun to remain true.")
    .Validate(options => options.DeviceType.Equals("Printer", StringComparison.OrdinalIgnoreCase), "Phase 1A supports Printer device type only.")
    .ValidateOnStart();

builder.Services.AddSingleton<AccentSequenceGenerator>();
builder.Services.AddSingleton<AccentPacketBuilder>();
builder.Services.AddSingleton<AccentResponseParser>();
builder.Services.AddSingleton<ISerialPortClient, SerialPortClient>();
builder.Services.AddScoped<IFiscalBridgeService, FiscalBridgeService>();

builder.Services.AddControllers();
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

var app = builder.Build();

app.UseCors("frontend");
app.MapControllers();

app.Run();
