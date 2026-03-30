// FiscalBridge HTTP client — http://localhost:3001/api/fiscal
// Source of truth: FiscalBridge API spec (SY55 fiscal device via ASP.NET Core)

const FISCAL_BASE = 'http://localhost:3001/api/fiscal';

// ─── Custom errors ────────────────────────────────────────────────────────────

export class FiscalBridgeOfflineError extends Error {
	constructor() {
		super('FiscalBridge е офлајн. Провери дали апликацијата работи на порт 3001.');
		this.name = 'FiscalBridgeOfflineError';
	}
}

export class FiscalBridgeError extends Error {
	constructor(
		message: string,
		public readonly errorStatus?: string,
	) {
		super(message);
		this.name = 'FiscalBridgeError';
	}
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/** P=passed, F=failed, D=partial payment (still open), R=change due */
export type ErrorStatus = 'P' | 'F' | 'D' | 'R';

export type DeviceStatusResponse = {
	IsConnected: boolean;
	StatusBytes?: string;
	// Byte 0
	GeneralError?: boolean;
	InvalidCommand?: boolean;
	SyntaxError?: boolean;
	// Byte 1
	CommandNotPermitted?: boolean;
	Overflow?: boolean;
	// Byte 2
	NonfiscalReceiptOpen?: boolean;
	EjNearlyFull?: boolean;
	FiscalReceiptOpen?: boolean;
	EjFull?: boolean;
	EndOfPaper?: boolean;
	// Byte 4
	FiscalMemoryFull?: boolean;
	LessThan50Reports?: boolean;
	SerialNumberSet?: boolean;
	TaxNumberSet?: boolean;
	ErrorWritingFm?: boolean;
	// Byte 5
	VatSet?: boolean;
	EcrFiscalized?: boolean;
	FmFormatted?: boolean;
};

export type TransactionStatusResponse = {
	IsOpen: boolean;
	SlipNumber?: number;
	OperatorCode?: string;
};

export type OpenReceiptRequest = {
	opCode: string;
	opPwd: string;
	storno: number; // 0 = normal receipt, 1 = storno
};

export type OpenReceiptResponse = {
	ErrorStatus: ErrorStatus;
	SlipNumber: number;
	Message?: string;
};

export type RegisterSaleRequest = {
	pluName: string;
	/** 1=A (standard), 2=Б, 3=В, 4=Г */
	taxCode: 1 | 2 | 3 | 4;
	price: number;
	quantity: number;
	isMacedonian?: number; // 1 = yes, 0 = no
	/** discountType=4 means "discount sum" (absolute denar amount) */
	discountType?: number;
	/** Total discount in denars for the whole line (base - final) * qty */
	discountValue?: number;
};

export type RegisterSaleResponse = {
	ErrorStatus: ErrorStatus;
	Message?: string;
};

export type SubtotalRequest = {
	print: number; // 0 = don't print, 1 = print
	display: number; // 0 = don't display, 1 = display
};

export type SubtotalResponse = {
	ErrorStatus: ErrorStatus;
	/** Running total of the receipt (string from device) */
	Subtotal?: string;
	Message?: string;
};

export type PaymentRequest = {
	/** 0=cash, 1=card, 2=credit */
	paidMode: 0 | 1 | 2;
	amount: number;
};

export type PaymentResponse = {
	ErrorStatus: ErrorStatus;
	/** Remaining amount when D (partial), or change when R (overpaid) */
	Amount?: string;
	Message?: string;
};

export type CloseReceiptResponse = {
	ErrorStatus: ErrorStatus;
	SlipNumber?: number;
	FiscalNumber?: string;
	Message?: string;
};

export type CashOperationRequest = {
	/** 0 = cash-in, 1 = cash-out */
	type: 0 | 1;
	amount: number;
};

export type CashOperationResponse = {
	ErrorStatus: ErrorStatus;
	Message?: string;
};

export type ReportType = 'X' | 'Z';

export type ReportRequest = {
	reportType: ReportType;
};

export type ReportResponse = {
	ErrorStatus: ErrorStatus;
	Message?: string;
};

/** Full item record returned by Command 107h (GET /items/all) */
export type ItemDetail = {
	Plu: number;
	TaxGr: number;
	Dep: number;
	Group: number;
	PriceType: number;
	Price: string;       // decimal serialised as string by the device
	Turnover: string;
	SoldQty: string;
	StockQty: string;
	Bar1?: string | null;
	Bar2?: string | null;
	Bar3?: string | null;
	Bar4?: string | null;
	Name: string;
};

export type FiscalItemsResponse = {
	ErrorStatus: ErrorStatus;
	Items: ItemDetail[];
	Message?: string;
};

// ─── Datetime (61h / 62h) ─────────────────────────────────────────────────────

export type SetDateTimeRequest = {
	/** Format: "DD-MM-YY hh:mm:ss" — optionally append " DST" for summer time */
	dateTime: string;
};

export type SetDateTimeResponse = {
	ErrorStatus: ErrorStatus;
	Message?: string;
};

export type DateTimeResponse = {
	ErrorStatus: ErrorStatus;
	/** Format: "DD-MM-YY hh:mm:ss [DST]" */
	DateTime?: string;
	Message?: string;
};

// ─── Last fiscal entry (64h) ──────────────────────────────────────────────────

export type LastEntryResponse = {
	ErrorStatus: ErrorStatus;
	NRep?: string;
	SumA?: string;
	SumB?: string;
	SumC?: string;
	SumD?: string;
	/** Format: "DD-MM-YY" */
	Date?: string;
	Message?: string;
};

// ─── Memory reports (94h / 95h) ───────────────────────────────────────────────

export type MemoryReportByDateRequest = {
	/** 0 = short, 1 = detailed */
	type: 0 | 1;
	/** DD-MM-YY. Default: date of fiscalisation */
	start?: string;
	/** DD-MM-YY. Default: current date */
	end?: string;
};

export type MemoryReportByZRequest = {
	/** 0 = short, 1 = detailed */
	type: 0 | 1;
	/** First Z-report number. Default: 1 */
	first?: number;
	/** Last Z-report number. Default: last Z */
	last?: number;
};

export type MemoryReportResponse = {
	ErrorStatus: ErrorStatus;
	Message?: string;
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function fiscalFetch<T>(path: string, options?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${FISCAL_BASE}${path}`, {
			headers: { 'Content-Type': 'application/json' },
			...options,
		});
	} catch {
		throw new FiscalBridgeOfflineError();
	}

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new FiscalBridgeError(`FiscalBridge HTTP ${res.status}: ${text}`, String(res.status));
	}

	return res.json() as Promise<T>;
}

function assertPassed(status: ErrorStatus, message?: string): void {
	if (status === 'P') return;
	const label = status === 'F' ? 'Неуспешно' : status === 'D' ? 'Делумна уплата' : status === 'R' ? 'Се врши кусур' : status;
	throw new FiscalBridgeError(message ?? `Фискалната операција не успеа (${label})`, status);
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const fiscalBridge = {
	/** GET /status — check device connectivity */
	getStatus: () => fiscalFetch<DeviceStatusResponse>('/status'),

	/** GET /transaction/status — check whether a receipt is already open */
	getTransactionStatus: () => fiscalFetch<TransactionStatusResponse>('/transaction/status'),

	/** POST /receipt/open — begin a new fiscal receipt */
	openReceipt: async (req: OpenReceiptRequest): Promise<OpenReceiptResponse> => {
		const res = await fiscalFetch<OpenReceiptResponse>('/receipt/open', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/** POST /receipt/sale — register one line item */
	registerSale: async (req: RegisterSaleRequest): Promise<RegisterSaleResponse> => {
		const res = await fiscalFetch<RegisterSaleResponse>('/receipt/sale', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/** POST /receipt/subtotal — display/print running total */
	subtotal: async (req: SubtotalRequest): Promise<SubtotalResponse> => {
		const res = await fiscalFetch<SubtotalResponse>('/receipt/subtotal', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/**
	 * POST /receipt/payment — register payment.
	 * D (partial) and R (change) are normal — returned as-is without throwing.
	 */
	payment: async (req: PaymentRequest): Promise<PaymentResponse> => {
		const res = await fiscalFetch<PaymentResponse>('/receipt/payment', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		if (res.ErrorStatus === 'D' || res.ErrorStatus === 'R') return res;
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/** POST /receipt/close — finalise and print the receipt */
	closeReceipt: async (): Promise<CloseReceiptResponse> => {
		const res = await fiscalFetch<CloseReceiptResponse>('/receipt/close', {
			method: 'POST',
			body: '{}',
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/** POST /cash — cash-in or cash-out operation */
	cashOperation: async (req: CashOperationRequest): Promise<CashOperationResponse> => {
		const res = await fiscalFetch<CashOperationResponse>('/cash', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/** POST /reports — print X or Z report */
	printReport: async (req: ReportRequest): Promise<ReportResponse> => {
		const res = await fiscalFetch<ReportResponse>('/reports', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/** GET /items/all — list all programmed fiscal items */
	getAllItems: async (): Promise<ItemDetail[]> => {
		const res = await fiscalFetch<FiscalItemsResponse>('/items/all');
		assertPassed(res.ErrorStatus, res.Message);
		return res.Items;
	},

	/** GET /datetime — read current fiscal device date/time (62h) */
	getDateTime: () => fiscalFetch<DateTimeResponse>('/datetime'),

	/** POST /datetime/set — set fiscal device date/time (61h) */
	setDateTime: async (req: SetDateTimeRequest): Promise<SetDateTimeResponse> => {
		const res = await fiscalFetch<SetDateTimeResponse>('/datetime/set', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/** GET /lastentry — last fiscal entry info (64h). type 0-7, default 0 */
	getLastEntry: (type = 0) => fiscalFetch<LastEntryResponse>(`/lastentry?type=${type}`),

	/** POST /memory/report/date — fiscal memory report by date range (94h) */
	memoryReportByDate: async (req: MemoryReportByDateRequest): Promise<MemoryReportResponse> => {
		const res = await fiscalFetch<MemoryReportResponse>('/memory/report/date', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},

	/** POST /memory/report/znumber — fiscal memory report by Z-report range (95h) */
	memoryReportByZ: async (req: MemoryReportByZRequest): Promise<MemoryReportResponse> => {
		const res = await fiscalFetch<MemoryReportResponse>('/memory/report/znumber', {
			method: 'POST',
			body: JSON.stringify(req),
		});
		assertPassed(res.ErrorStatus, res.Message);
		return res;
	},
};

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Map DB tax_group business percentage → FiscalBridge TaxCode (1-4).
 *   18 % → 1 (A)
 *    5 % → 2 (Б)
 *   10 % → 3 (В)
 *    0 / null / undefined → 4 (Г, exempt)
 * Throws on any other value to catch configuration mistakes early.
 */
export function toFiscalTaxCode(taxPercent: number | null | undefined): 1 | 2 | 3 | 4 {
	switch (taxPercent) {
		case 18: return 1;
		case 5:  return 2;
		case 10: return 3;
		case 0:
		case null:
		case undefined: return 4;
		default: throw new Error(`Непозната даночна стапка: ${taxPercent}`);
	}
}

/** Truncate product name to 32 chars (SY55 PluName limit per Command 49h). */
export function truncateFiscalName(name: string, maxLen = 32): string {
	return name.length > maxLen ? name.slice(0, maxLen) : name;
}

/** Map app payment method → FiscalBridge PaymentMode. */
export function toFiscalPaymentMode(method: 'CASH' | 'CARD'): 0 | 1 {
	return method === 'CASH' ? 0 : 1;
}
