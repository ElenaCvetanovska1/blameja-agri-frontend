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
	Status: string;
	Model?: string;
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
	Amount?: number;
	Message?: string;
};

export type PaymentRequest = {
	/** 0=cash, 1=card, 2=credit */
	paidMode: 0 | 1 | 2;
	amount: number;
};

export type PaymentResponse = {
	ErrorStatus: ErrorStatus;
	Change?: number;
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

export type FiscalItem = {
	Plu: number;
	Name: string;
	Price: number;
	TaxCode: number;
	Quantity?: number;
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
	getAllItems: () => fiscalFetch<FiscalItem[]>('/items/all'),
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

/** Truncate product name to 36 chars (SY55 display limit). */
export function truncateFiscalName(name: string, maxLen = 36): string {
	return name.length > maxLen ? name.slice(0, maxLen) : name;
}

/** Map app payment method → FiscalBridge PaymentMode. */
export function toFiscalPaymentMode(method: 'CASH' | 'CARD'): 0 | 1 {
	return method === 'CASH' ? 0 : 1;
}
