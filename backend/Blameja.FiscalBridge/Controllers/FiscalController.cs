using System.Diagnostics;
using System.Globalization;
using Blameja.FiscalBridge.Models;
using Blameja.FiscalBridge.Protocol;
using Blameja.FiscalBridge.Services;
using Microsoft.AspNetCore.Mvc;

namespace Blameja.FiscalBridge.Controllers;

[ApiController]
[Route("api/fiscal")]
public sealed class FiscalController(IFiscalBridgeService fiscalBridge, ILogger<FiscalController> logger) : ControllerBase
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

    // PAPER_FEED (0x2C) — извлекува лента неколку линии (за да се откине заглавено ливче). Не-фискална.
    [HttpPost("paper/feed")]
    public async Task<ActionResult<FiscalRealCommandResponse>> PaperFeed(CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecutePaperFeedAsync(
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    // SET_DATE_TIME (0x3D) — поставува датум/час на уредот; празно тело = системско време.
    [HttpPost("date-time/set")]
    public async Task<ActionResult<FiscalRealCommandResponse>> SetDateTime(
        [FromBody] FiscalSetDateTimeRequest? request,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request?.DateTimeText)
            && !DateTime.TryParse(request.DateTimeText, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out _))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["dateTimeText"] = ["dateTimeText must be a valid date/time (e.g. 2026-07-16T14:30:00)."]
            }));
        }

        var response = await fiscalBridge.ExecuteSetDateTimeAsync(
            request,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpPost("articles/program")]
    public async Task<ActionResult<FiscalRealCommandResponse>> ProgramArticle(
        [FromBody] ProgramArticleRequest? request,
        CancellationToken cancellationToken)
    {
        var errors = ValidateProgramArticle(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        var response = await fiscalBridge.ExecuteProgramArticleAsync(
            request!,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpGet("articles/read/{plu:int}")]
    public async Task<ActionResult<FiscalArticleDto>> ReadArticle(
        int plu,
        CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteReadArticleAsync(
            plu,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);
        if (!response.Success)
        {
            return Conflict(response);
        }

        return Ok(ParseArticle(response.DataText, plu));
    }

    [HttpGet("articles")]
    public async Task<ActionResult<IReadOnlyList<FiscalArticleDto>>> ReadAllArticles(CancellationToken cancellationToken)
    {
        var programmingConfirmationHeader = Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault();
        var articles = new List<FiscalArticleDto>();

        var response = await fiscalBridge.ExecuteFindFirstProgrammedArticleAsync(
            programmingConfirmationHeader,
            cancellationToken);
        if (IsBlocked(response))
        {
            LogArticleReadCommand(response, "F\t\t", articles.Count);
            return Conflict(response);
        }

        if (!HasProgrammedArticleData(response))
        {
            LogArticleReadCommand(response, "F\t\t", articles.Count);
            return Ok(articles);
        }

        articles.Add(ParseArticle(response.DataText, 0));
        LogArticleReadCommand(response, "F\t\t", articles.Count);

        while (true)
        {
            response = await fiscalBridge.ExecuteFindNextProgrammedArticleAsync(
                programmingConfirmationHeader,
                cancellationToken);
            if (IsBlocked(response))
            {
                LogArticleReadCommand(response, "N\t", articles.Count);
                return Conflict(response);
            }

            if (!HasProgrammedArticleData(response))
            {
                LogArticleReadCommand(response, "N\t", articles.Count);
                break;
            }

            articles.Add(ParseArticle(response.DataText, 0));
            LogArticleReadCommand(response, "N\t", articles.Count);
        }

        return Ok(articles);
    }

    [HttpPost("articles/delete")]
    public async Task<ActionResult<FiscalRealCommandResponse>> DeleteArticle(
        [FromBody] DeleteArticleRequest? request,
        CancellationToken cancellationToken)
    {
        var errors = ValidateDeleteArticle(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        var response = await fiscalBridge.ExecuteDeleteArticleAsync(
            request!,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpPost("cash/in")]
    public async Task<ActionResult<FiscalRealCommandResponse>> CashIn(
        [FromBody] CashMovementRequest? request,
        CancellationToken cancellationToken)
    {
        var errors = ValidateCashMovement(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        var response = await fiscalBridge.ExecuteCashInAsync(
            request!,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpPost("cash/out")]
    public async Task<ActionResult<FiscalRealCommandResponse>> CashOut(
        [FromBody] CashMovementRequest? request,
        CancellationToken cancellationToken)
    {
        var errors = ValidateCashMovement(request);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        var response = await fiscalBridge.ExecuteCashOutAsync(
            request!,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    // Single official X-report endpoint. On this device command 0x45 exposes only the extended
    // control report (ПРОШИРЕН); see docs/fiscal/x-z-report-device-mode-findings.md.
    [HttpPost("reports/x")]
    public async Task<ActionResult<FiscalRealCommandResponse>> XReport(
        [FromBody] XReportRequest? request,
        CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteXReportAsync(
            request ?? new XReportRequest(),
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpPost("reports/z")]
    public async Task<ActionResult<FiscalRealCommandResponse>> ZReport(
        [FromBody] ZReportRequest? request,
        CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteZReportAsync(
            request ?? new ZReportRequest(),
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    // Fiscal-memory report from date to date (period). detailed=false → short, true → detailed.
    [HttpPost("reports/fm-date")]
    public async Task<ActionResult<FiscalRealCommandResponse>> FmDateReport(
        [FromBody] FmReportRequest? request,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (!DateTime.TryParse(request?.From, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var fromDate))
        {
            errors["from"] = ["from is required and must be a valid date (e.g. 2026-07-01)."];
        }

        if (!DateTime.TryParse(request?.To, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var toDate))
        {
            errors["to"] = ["to is required and must be a valid date (e.g. 2026-07-15)."];
        }

        if (errors.Count == 0 && fromDate.Date > toDate.Date)
        {
            errors["from"] = ["from must be on or before to."];
        }

        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        var response = await fiscalBridge.ExecuteFmDateReportAsync(
            fromDate,
            toDate,
            request!.Detailed,
            request.ConfirmPrint,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
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

    // Recovery: abort a stuck/half-open receipt (CANCEL_FISCAL_RECEIPT 0x3C). Discards it, no fiscal record.
    [HttpPost("receipt/cancel")]
    public async Task<ActionResult<FiscalRealCommandResponse>> CancelReceipt(
        [FromBody] CancelReceiptRequest? request,
        CancellationToken cancellationToken)
    {
        var response = await fiscalBridge.ExecuteCancelReceiptAsync(
            request ?? new CancelReceiptRequest(),
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    // STORNO — void receipt in one call: OPEN_VOID (0x55) → REGISTER_SALE (0x31) per item →
    // CALCULATE_TOTAL (0x35) → CLOSE_VOID (0x56). Items/payment are positive; no original-receipt
    // reference (Option A, exact Java void-receipt port). Same print protections as a normal receipt.
    [HttpPost("receipt/storno")]
    public async Task<ActionResult<StornoResponse>> Storno(
        [FromBody] StornoRequest? request,
        CancellationToken cancellationToken)
    {
        if (request is null || request.Items.Count == 0)
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["items"] = ["At least one storno item is required."]
            }));
        }

        var saleRequests = new List<ReceiptSaleRequest>();
        foreach (var item in request.Items)
        {
            var sale = new ReceiptSaleRequest
            {
                ConfirmPrint = request.ConfirmPrint,
                Description = item.Description,
                VatGroup = item.VatGroup,
                Price = item.Price,
                Quantity = item.Quantity,
                MacedonianItem = item.MacedonianItem,
                PriceCorrectionType = item.PriceCorrectionType,
                PriceCorrectionValue = item.PriceCorrectionValue
            };

            var saleErrors = ValidateReceiptSale(sale);
            if (saleErrors.Count > 0)
            {
                return BadRequest(new ValidationProblemDetails(saleErrors));
            }

            saleRequests.Add(sale);
        }

        var paymentRequest = new ReceiptPaymentRequest
        {
            ConfirmPrint = request.ConfirmPrint,
            PaymentMethod = request.PaymentMethod,
            Amount = request.Amount,
            InfoLine1 = request.InfoLine1,
            InfoLine2 = request.InfoLine2
        };

        var paymentErrors = ValidateReceiptPayment(paymentRequest);
        if (paymentErrors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(paymentErrors));
        }

        var printConfirmationHeader = Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault();
        var stopwatch = Stopwatch.StartNew();
        var saleResults = new List<FiscalRealCommandResponse>();

        var openResult = await fiscalBridge.ExecuteOpenFiscalReceiptAsync(
            new ReceiptOpenRequest { ConfirmPrint = request.ConfirmPrint, Storno = true },
            printConfirmationHeader,
            cancellationToken);
        if (!openResult.Success)
        {
            stopwatch.Stop();
            return Conflict(new StornoResponse(openResult, saleResults, null, null, false, stopwatch.ElapsedMilliseconds));
        }

        foreach (var sale in saleRequests)
        {
            var saleResult = await fiscalBridge.ExecuteRegisterSaleAsync(sale, printConfirmationHeader, cancellationToken);
            saleResults.Add(saleResult);
            if (!saleResult.Success)
            {
                stopwatch.Stop();
                return Conflict(new StornoResponse(openResult, saleResults, null, null, false, stopwatch.ElapsedMilliseconds));
            }
        }

        var paymentResult = await fiscalBridge.ExecuteReceiptPaymentAsync(paymentRequest, printConfirmationHeader, cancellationToken);
        if (!paymentResult.Success)
        {
            stopwatch.Stop();
            return Conflict(new StornoResponse(openResult, saleResults, paymentResult, null, false, stopwatch.ElapsedMilliseconds));
        }

        var closeResult = await fiscalBridge.ExecuteCloseFiscalReceiptAsync(
            new ReceiptCloseRequest { ConfirmPrint = request.ConfirmPrint, Storno = true },
            printConfirmationHeader,
            cancellationToken);

        stopwatch.Stop();
        var response = new StornoResponse(
            openResult,
            saleResults,
            paymentResult,
            closeResult,
            closeResult.Success,
            stopwatch.ElapsedMilliseconds);

        return response.OverallSuccess ? Ok(response) : Conflict(response);
    }

    // DEV-ONLY raw command probe: send any command id + payload to discover exact device formats.
    [HttpPost("dev/raw")]
    public async Task<ActionResult<FiscalRealCommandResponse>> RawCommand(
        [FromBody] RawCommandRequest? request,
        CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.CommandId))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["commandId"] = ["commandId is required (decimal e.g. 48, or hex e.g. 0x30)."]
            }));
        }

        var raw = request.CommandId.Trim();
        var parsed = raw.StartsWith("0x", StringComparison.OrdinalIgnoreCase)
            ? byte.TryParse(raw[2..], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var hexId) ? hexId : (byte?)null
            : byte.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var decId) ? decId : (byte?)null;

        if (parsed is not { } commandId)
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["commandId"] = ["commandId must be a byte value 0-255 (decimal or 0x hex)."]
            }));
        }

        var response = await fiscalBridge.ExecuteRawCommandAsync(
            commandId,
            $"RAW_0x{commandId:X2}",
            string.IsNullOrEmpty(request.Payload) ? null : request.Payload,
            request.ConfirmPrint,
            Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault(),
            cancellationToken);

        return IsBlocked(response) ? Conflict(response) : Ok(response);
    }

    [HttpPost("dev/test-receipt")]
    public async Task<ActionResult<DevTestReceiptResponse>> DevTestReceipt(
        [FromBody] DevTestReceiptRequest? request,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["request"] = ["Request body is required."]
            }));
        }

        var saleRequest = new ReceiptSaleRequest
        {
            ConfirmPrint = request.ConfirmPrint,
            Description = request.Description,
            VatGroup = request.VatGroup,
            Price = request.Price,
            Quantity = request.Quantity,
            MacedonianItem = request.MacedonianItem
        };
        var saleErrors = ValidateReceiptSale(saleRequest);
        if (saleErrors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(saleErrors));
        }

        var paymentRequest = new ReceiptPaymentRequest
        {
            ConfirmPrint = request.ConfirmPrint,
            PaymentMethod = request.PaymentMethod,
            Amount = request.PaymentAmount
        };
        var paymentErrors = ValidateReceiptPayment(paymentRequest);
        if (paymentErrors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(paymentErrors));
        }

        var printConfirmationHeader = Request.Headers["X-Fiscal-Print-Confirmation"].FirstOrDefault();
        var stopwatch = Stopwatch.StartNew();

        var openResult = await fiscalBridge.ExecuteOpenFiscalReceiptAsync(
            new ReceiptOpenRequest { ConfirmPrint = request.ConfirmPrint },
            printConfirmationHeader,
            cancellationToken);
        if (!openResult.Success)
        {
            stopwatch.Stop();
            return Conflict(new DevTestReceiptResponse(openResult, null, null, null, false, stopwatch.ElapsedMilliseconds));
        }

        var saleResult = await fiscalBridge.ExecuteRegisterSaleAsync(
            saleRequest,
            printConfirmationHeader,
            cancellationToken);
        if (!saleResult.Success)
        {
            stopwatch.Stop();
            return Conflict(new DevTestReceiptResponse(openResult, saleResult, null, null, false, stopwatch.ElapsedMilliseconds));
        }

        var paymentResult = await fiscalBridge.ExecuteReceiptPaymentAsync(
            paymentRequest,
            printConfirmationHeader,
            cancellationToken);
        if (!paymentResult.Success)
        {
            stopwatch.Stop();
            return Conflict(new DevTestReceiptResponse(openResult, saleResult, paymentResult, null, false, stopwatch.ElapsedMilliseconds));
        }

        var closeResult = await fiscalBridge.ExecuteCloseFiscalReceiptAsync(
            new ReceiptCloseRequest { ConfirmPrint = request.ConfirmPrint },
            printConfirmationHeader,
            cancellationToken);

        stopwatch.Stop();
        var response = new DevTestReceiptResponse(
            openResult,
            saleResult,
            paymentResult,
            closeResult,
            closeResult.Success,
            stopwatch.ElapsedMilliseconds);

        return response.OverallSuccess ? Ok(response) : Conflict(response);
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

    private static Dictionary<string, string[]> ValidateProgramArticle(ProgramArticleRequest? request)
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

        if (request.Name is null)
        {
            Add("name", "Name must not be null.");
        }

        if (!IsValidVatGroup(request.VatGroup))
        {
            Add("vatGroup", "VAT group must be A, B, V, or G.");
        }

        return ToValidationDictionary(errors);
    }

    private static Dictionary<string, string[]> ValidateCashMovement(CashMovementRequest? request)
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

        if (request.Amount <= 0)
        {
            Add("amount", "Amount must be greater than 0.");
        }

        return ToValidationDictionary(errors);
    }

    private static Dictionary<string, string[]> ValidateDeleteArticle(DeleteArticleRequest? request)
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

        if (request.Plu <= 0)
        {
            Add("plu", "PLU must be greater than 0.");
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
            "PRINT_CONFIRMATION_HEADER_MISSING" or
            "PROGRAMMING_NOT_CONFIRMED" or
            "PROGRAMMING_CONFIRMATION_HEADER_MISSING";
    }

    private static FiscalArticleDto ParseArticle(string dataText, int requestedPlu)
    {
        return dataText.Contains('\t', StringComparison.Ordinal)
            ? ParseCashRegisterArticle(dataText, requestedPlu)
            : ParsePrinterArticle(dataText, requestedPlu);
    }

    private static bool HasProgrammedArticleData(FiscalRealCommandResponse response)
    {
        return response.Success && response.DataBytes.Count >= 1 && response.DataBytes[0] == 'P';
    }

    private void LogArticleReadCommand(FiscalRealCommandResponse response, string payload, int totalArticlesFound)
    {
        logger.LogInformation(
            "Article read command completed. Command={Command} Payload={Payload} RequestHex={RequestHex} ResponseHex={ResponseHex} ElapsedMs={ElapsedMs} TotalArticlesFound={TotalArticlesFound}",
            response.CommandName,
            payload,
            response.RequestHex,
            response.ResponseHex,
            response.ElapsedMs,
            totalArticlesFound);
    }

    private static FiscalArticleDto ParsePrinterArticle(string dataText, int requestedPlu)
    {
        var fields = dataText.Split(',');
        if (fields.Length < 8
            || !int.TryParse(fields[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var plu)
            || !TryParsePrinterVatGroup(fields[3], out var vatGroup)
            || !decimal.TryParse(fields[4], NumberStyles.Number, CultureInfo.InvariantCulture, out var price))
        {
            return DefaultArticle(requestedPlu);
        }

        return new FiscalArticleDto(
            Plu: plu,
            Name: fields[7],
            Price: price,
            VatGroup: vatGroup,
            Department: 1,
            Group: 1,
            PriceType: 3,
            Quantity: 0,
            Barcode1: "0",
            Barcode2: "0",
            Barcode3: "0",
            Barcode4: "0",
            Programmed: true);
    }

    private static FiscalArticleDto ParseCashRegisterArticle(string dataText, int requestedPlu)
    {
        var fields = dataText.Split('\t');
        if (fields.Length < 15
            || !int.TryParse(fields[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var plu)
            || !TryParseCashRegisterVatGroup(fields[2], out var vatGroup)
            || !int.TryParse(fields[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out var department)
            || !int.TryParse(fields[4], NumberStyles.Integer, CultureInfo.InvariantCulture, out var group)
            || !int.TryParse(fields[5], NumberStyles.Integer, CultureInfo.InvariantCulture, out var priceType)
            || !decimal.TryParse(fields[6], NumberStyles.Number, CultureInfo.InvariantCulture, out var price)
            || !decimal.TryParse(fields[9], NumberStyles.Number, CultureInfo.InvariantCulture, out var quantity))
        {
            return DefaultArticle(requestedPlu);
        }

        return new FiscalArticleDto(
            Plu: plu,
            Name: fields[14].ToUpper(CultureInfo.CurrentCulture),
            Price: price,
            VatGroup: vatGroup,
            Department: department,
            Group: group,
            PriceType: priceType,
            Quantity: quantity,
            Barcode1: fields[10],
            Barcode2: fields[11],
            Barcode3: fields[12],
            Barcode4: fields[13],
            Programmed: true);
    }

    private static FiscalArticleDto DefaultArticle(int plu)
    {
        return new FiscalArticleDto(
            Plu: plu,
            Name: string.Empty,
            Price: 0,
            VatGroup: "A",
            Department: 1,
            Group: 1,
            PriceType: 3,
            Quantity: 0,
            Barcode1: "0",
            Barcode2: "0",
            Barcode3: "0",
            Barcode4: "0",
            Programmed: false);
    }

    private static bool TryParsePrinterVatGroup(string value, out string vatGroup)
    {
        vatGroup = value.Length == 0
            ? string.Empty
            : value[0] switch
            {
                var c when c == AccentProtocol.ToVatChar(AccentVatGroup.A) => "A",
                var c when c == AccentProtocol.ToVatChar(AccentVatGroup.B) => "B",
                var c when c == AccentProtocol.ToVatChar(AccentVatGroup.V) => "V",
                var c when c == AccentProtocol.ToVatChar(AccentVatGroup.G) => "G",
                _ => string.Empty
            };

        return vatGroup.Length > 0;
    }

    private static bool TryParseCashRegisterVatGroup(string value, out string vatGroup)
    {
        vatGroup = value switch
        {
            "1" => "A",
            "2" => "B",
            "3" => "V",
            "4" => "G",
            _ => string.Empty
        };

        return vatGroup.Length > 0;
    }

    private static Dictionary<string, string[]> ToValidationDictionary(Dictionary<string, List<string>> errors)
    {
        return errors.ToDictionary(x => x.Key, x => x.Value.ToArray(), StringComparer.OrdinalIgnoreCase);
    }
}
