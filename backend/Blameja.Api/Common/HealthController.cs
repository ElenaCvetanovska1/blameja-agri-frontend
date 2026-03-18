using Microsoft.AspNetCore.Mvc;

namespace Blameja.Api.Common;

[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    /// <summary>
    /// GET /health
    /// Lightweight liveness check — no DB query, just confirms the process is up.
    /// </summary>
    [HttpGet]
    public IActionResult Get() =>
        Ok(new { status = "ok", timestamp = DateTime.UtcNow });
}
