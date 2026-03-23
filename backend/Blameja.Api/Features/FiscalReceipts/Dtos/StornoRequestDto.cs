namespace Blameja.Api.Features.FiscalReceipts.Dtos;

/// <summary>
/// Request body for POST /api/fiscal-receipts/{id}/storno.
/// Contains the already-executed FiscalBridge result plus the item selection.
/// </summary>
public sealed class StornoRequestDto
{
    /// <summary>Items selected for return, with their storno quantities.</summary>
    public required List<StornoItemDto> Items  { get; init; }

    /// <summary>Payment method used for the refund (usually matches original).</summary>
    public string  Payment         { get; init; } = "CASH";

    /// <summary>Fiscal slip number returned by FiscalBridge after closeReceipt.</summary>
    public int?    FiscalSlipNo    { get; init; }

    /// <summary>Fiscal execution result: "success" | "failed" | "offline" | "partial" | "pending".</summary>
    public string  FiscalStatus    { get; init; } = "success";

    public string? FiscalError     { get; init; }

    /// <summary>Raw JSON bridge_response from FiscalBridge for audit trail.</summary>
    public string? BridgeResponse  { get; init; }

    /// <summary>Sum of (unit_price * storno_quantity) for all selected items.</summary>
    public decimal Total           { get; init; }

    public string? CreatedBy       { get; init; }
    public int?    StoreNo         { get; init; }
}

public sealed class StornoItemDto
{
    /// <summary>ID of the original fiscal_receipt_items row being returned.</summary>
    public Guid    OriginalItemId  { get; init; }

    /// <summary>How many units are being returned (must be ≤ remaining returnable qty).</summary>
    public decimal Quantity        { get; init; }
}
