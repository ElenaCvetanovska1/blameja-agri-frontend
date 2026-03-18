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
