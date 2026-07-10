using Blameja.FiscalBridge.Models;
using Blameja.FiscalBridge.Services;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;

namespace Blameja.FiscalBridge.Controllers;

[ApiController]
[Route("api/fiscal")]
public sealed class FiscalController(IFiscalBridgeService fiscalBridge) : ControllerBase
{
    [HttpGet("health")]
    public ActionResult<FiscalHealthResponse> Health()
    {
        return Ok(fiscalBridge.GetHealth());
    }

    [HttpGet("ports")]
    public ActionResult<IReadOnlyList<string>> Ports()
    {
        return Ok(fiscalBridge.GetAvailablePorts());
    }

    [HttpGet("status")]
    public async Task<ActionResult<FiscalRealCommandResponse>> Status(CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteStatusAsync(cancellationToken);
        return response.ResponseStatus == "REAL_SERIAL_DISABLED" ? Conflict(response) : Ok(response);
    }

    [HttpGet("diagnostic")]
    public async Task<ActionResult<FiscalRealCommandResponse>> Diagnostic(CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteDiagnosticAsync(cancellationToken);
        return response.ResponseStatus == "REAL_SERIAL_DISABLED" ? Conflict(response) : Ok(response);
    }

    [HttpGet("date-time")]
    public async Task<ActionResult<FiscalRealCommandResponse>> GetDateTime(CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteDateTimeAsync(cancellationToken);
        return response.ResponseStatus == "REAL_SERIAL_DISABLED" ? Conflict(response) : Ok(response);
    }

    [HttpPost("receipt/open")]
    public async Task<ActionResult<FiscalRealCommandResponse>> OpenReceipt(
        [FromBody] ReceiptOpenRequest? request,
        CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteOpenFiscalReceiptAsync(
            request ?? new ReceiptOpenRequest(),
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpPost("receipt/sale")]
    public async Task<ActionResult<FiscalRealCommandResponse>> RegisterSale(
        [FromBody] ReceiptSaleRequest? request,
        CancellationToken cancellationToken)
    {
        var errors = ValidateReceiptSale(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        var response = await fiscalBridge.ExecuteRegisterSaleAsync(
            request!,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpPost("receipt/payment")]
    public async Task<ActionResult<FiscalRealCommandResponse>> ReceiptPayment(
        [FromBody] ReceiptPaymentRequest? request,
        CancellationToken cancellationToken)
    {
        var errors = ValidateReceiptPayment(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        var response = await fiscalBridge.ExecuteReceiptPaymentAsync(
            request!,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpPost("receipt/close")]
    public async Task<ActionResult<FiscalRealCommandResponse>> CloseReceipt(
        [FromBody] ReceiptCloseRequest? request,
        CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteCloseFiscalReceiptAsync(
            request ?? new ReceiptCloseRequest(),
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpGet("status/dry-run")]
    public ActionResult<FiscalDryRunResponse> StatusDryRun()
    {
        return Ok(fiscalBridge.BuildStatusDryRun());
    }

    [HttpGet("diagnostic/dry-run")]
    public ActionResult<FiscalDryRunResponse> DiagnosticDryRun()
    {
        return Ok(fiscalBridge.BuildDiagnosticDryRun());
    }

    [HttpGet("date-time/dry-run")]
    public ActionResult<FiscalDryRunResponse> DateTimeDryRun()
    {
        return Ok(fiscalBridge.BuildDateTimeDryRun());
    }

    [HttpPost("receipt/dry-run")]
    public ActionResult<FiscalDryRunResponse> ReceiptDryRun([FromBody] FiscalReceiptRequest request)
    {
        var errors = ValidateReceipt(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        return Ok(fiscalBridge.BuildReceiptDryRun(request));
    }

    [HttpPost("cancel-receipt/dry-run")]
    public ActionResult<FiscalDryRunResponse> CancelReceiptDryRun()
    {
        return Ok(fiscalBridge.BuildCancelReceiptDryRun());
    }

    [HttpPost("z-report/dry-run")]
    public ActionResult<FiscalDryRunResponse> ZReportDryRun()
    {
        return Ok(fiscalBridge.BuildZReportDryRun());
    }

    [HttpPost("date-time/set/dry-run")]
    public ActionResult<FiscalDryRunResponse> SetDateTimeDryRun([FromBody] FiscalSetDateTimeRequest? request = null)
    {
        if (!string.IsNullOrWhiteSpace(request?.DateTimeText)
            && !DateTime.TryParse(request.DateTimeText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out _))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["dateTimeText"] = ["DateTimeText must be parseable, or omit it to use the current local time."]
            }));
        }

        return Ok(fiscalBridge.BuildSetDateTimeDryRun(request));
    }

    private static Dictionary<string, string[]> ValidateReceipt(FiscalReceiptRequest? request)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        void Add(string key, string message)
        {
            if (!errors.TryGetValue(key, out var messages))
            {
                messages = [];
                errors[key] = messages;
            }

            messages.Add(message);
        }

        if (request is null)
        {
            Add("request", "Request body is required.");
            return ToValidationDictionary(errors);
        }

        if (request.Items.Count == 0)
        {
            Add("items", "At least one receipt item is required.");
        }

        if (request.Total < 0)
        {
            Add("total", "Total must be greater than or equal to 0.");
        }

        if (!IsValidPayment(request.Payment))
        {
            Add("payment", "Payment must be Cash, Credit, Check, or Debit.");
        }

        for (var i = 0; i < request.Items.Count; i++)
        {
            var item = request.Items[i];
            var prefix = $"items[{i}]";

            if (item.Quantity <= 0)
            {
                Add($"{prefix}.quantity", "Quantity must be greater than 0.");
            }

            if (item.UnitPrice < 0)
            {
                Add($"{prefix}.unitPrice", "Unit price must be greater than or equal to 0.");
            }

            if (!IsValidVatGroup(item.VatGroup))
            {
                Add($"{prefix}.vatGroup", "VAT group must be A, B, V, or G.");
            }
        }

        return ToValidationDictionary(errors);
    }

    private static bool IsValidVatGroup(string? vatGroup)
    {
        return vatGroup?.Trim().ToUpperInvariant() is "A" or "B" or "V" or "G";
    }

    private static bool IsValidPayment(string? payment)
    {
        return payment?.Trim().ToUpperInvariant() is "CASH" or "CREDIT" or "CHECK" or "DEBIT";
    }

    private static Dictionary<string, string[]> ValidateReceiptSale(ReceiptSaleRequest? request)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        void Add(string key, string message)
        {
            if (!errors.TryGetValue(key, out var messages))
            {
                messages = [];
                errors[key] = messages;
            }

            messages.Add(message);
        }

        if (request is null)
        {
            Add("request", "Request body is required.");
            return ToValidationDictionary(errors);
        }

        if (request.Description is null)
        {
            Add("description", "Description must not be null.");
        }

        if (request.Price < 0)
        {
            Add("price", "Price must be greater than or equal to 0.");
        }

        if (request.Quantity < 0)
        {
            Add("quantity", "Quantity must be greater than or equal to 0.");
        }

        if (!IsValidVatGroup(request.VatGroup))
        {
            Add("vatGroup", "VAT group must be A, B, V, or G.");
        }

        if (!IsValidPriceCorrectionType(request.PriceCorrectionType))
        {
            Add("priceCorrectionType", "Price correction type must be NONE, DISCOUNT_VALUE, DISCOUNT_PERCENT, SURCHARGE_VALUE, or SURCHARGE_PERCENT.");
        }

        return ToValidationDictionary(errors);
    }

    private static Dictionary<string, string[]> ValidateReceiptPayment(ReceiptPaymentRequest? request)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        void Add(string key, string message)
        {
            if (!errors.TryGetValue(key, out var messages))
            {
                messages = [];
                errors[key] = messages;
            }

            messages.Add(message);
        }

        if (request is null)
        {
            Add("request", "Request body is required.");
            return ToValidationDictionary(errors);
        }

        if (request.Amount < 0)
        {
            Add("amount", "Amount must be greater than or equal to 0.");
        }

        if (!IsValidOptionalPayment(request.PaymentMethod))
        {
            Add("paymentMethod", "Payment method must be Cash, Credit, Check, Debit, or null.");
        }

        return ToValidationDictionary(errors);
    }

    private static bool IsValidPriceCorrectionType(string? correctionType)
    {
        return correctionType?.Trim().ToUpperInvariant() is null or "" or
            "NONE" or
            "DISCOUNT_VALUE" or
            "DISCOUNT_PERCENT" or
            "SURCHARGE_VALUE" or
            "SURCHARGE_PERCENT";
    }

    private static bool IsValidOptionalPayment(string? payment)
    {
        return string.IsNullOrWhiteSpace(payment) || IsValidPayment(payment);
    }

    private static bool IsBlocked(FiscalRealCommandResponse response)
    {
        return response.ResponseStatus is
            "REAL_SERIAL_DISABLED" or
            "RECEIPT_PRINTING_DISABLED" or
            "PRINT_NOT_CONFIRMED" or
            "PRINT_CONFIRMATION_HEADER_MISSING";
    }

    private static Dictionary<string, string[]> ToValidationDictionary(Dictionary<string, List<string>> errors)
    {
        return errors.ToDictionary(x => x.Key, x => x.Value.ToArray(), StringComparer.OrdinalIgnoreCase);
    }
}
