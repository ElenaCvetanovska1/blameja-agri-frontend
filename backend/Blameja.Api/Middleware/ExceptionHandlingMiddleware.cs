using Npgsql;

namespace Blameja.Api.Middleware;

/// <summary>
/// Converts unhandled exceptions into clean JSON error responses.
/// Keeps controllers thin — they never need try/catch for infrastructure errors.
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _log;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> log)
    {
        _next = next;
        _log  = log;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (ApiException ex)
        {
            // Known business-rule or validation failures — log as warning, return 4xx
            _log.LogWarning("API error {Status}: {Message}", ex.StatusCode, ex.Message);
            ctx.Response.StatusCode  = ex.StatusCode;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
        }
        catch (PostgresException ex)
        {
            // Познати грешки од базата (дупликати, преголеми броеви…) — читлива порака наместо 500.
            var (status, message) = MapPostgresError(ex);
            _log.LogWarning("DB error {SqlState} ({Constraint}): {Message}",
                ex.SqlState, ex.ConstraintName, ex.MessageText);
            ctx.Response.StatusCode  = status;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new { error = message });
        }
        catch (Exception ex)
        {
            // Unexpected errors — log as error, return 500
            _log.LogError(ex, "Unhandled exception on {Method} {Path}",
                ctx.Request.Method, ctx.Request.Path);
            ctx.Response.StatusCode  = StatusCodes.Status500InternalServerError;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(
                new { error = "An unexpected error occurred. Please try again." });
        }
    }

    /// <summary>Преведува чести Postgres грешки во читливи пораки на македонски.</summary>
    private static (int status, string message) MapPostgresError(PostgresException ex) => ex.SqlState switch
    {
        // 23505 — unique violation (дупликат)
        "23505" => (StatusCodes.Status409Conflict, ex.ConstraintName switch
        {
            "products_plu_unique"               => "PLU-то е веќе зафатено од друг производ.",
            "products_unique_name_per_category" => "Веќе постои производ со тоа име во таа категорија.",
            _ when ex.ConstraintName?.Contains("barcode", StringComparison.OrdinalIgnoreCase) == true
                                                => "Баркодот е веќе зафатен од друг производ.",
            _                                    => "Записот веќе постои (дупликат вредност)."
        }),
        // 22003 — numeric overflow (преголема бројка)
        "22003" => (StatusCodes.Status400BadRequest,
            "Внесената вредност е преголема. Провери цена, количина или PLU (можеби баркод е внесен во погрешно поле)."),
        // 23502 — not null violation
        "23502" => (StatusCodes.Status400BadRequest, "Недостасува задолжително поле."),
        // 23503 — foreign key violation
        "23503" => (StatusCodes.Status400BadRequest, "Поврзан запис не постои (пр. категорија/добавувач)."),
        _       => (StatusCodes.Status400BadRequest, "Грешка во базата на податоци. Провери ги внесените вредности.")
    };
}

/// <summary>
/// Throw this for expected business-rule or validation failures.
/// Maps to the specified HTTP status code (default 400).
/// </summary>
public sealed class ApiException : Exception
{
    public int StatusCode { get; }

    public ApiException(string message, int statusCode = StatusCodes.Status400BadRequest)
        : base(message)
    {
        StatusCode = statusCode;
    }
}
