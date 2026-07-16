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

// ═══ REAL FiscalBridge API (актуелен контракт) ═══════════════════════════════
// Точни типови спрема Blameja.FiscalBridge (ASP.NET Core). JSON е camelCase.
// Групa: Инфо / статус (read-only): /health /ports /status /diagnostic /date-time

export type FiscalHealth = {
	success: boolean;
	dryRun: boolean;
	deviceType: string;
	comPort: string;
	baudRate: number;
	supportedCommands: string[];
};

/** Одговор од секоја реална команда (FiscalRealCommandResponse). */
export type FiscalCommandResult = {
	success: boolean;
	dryRun: boolean;
	commandName: string;
	commandIdHex: string;
	comPort: string;
	baudRate: number;
	requestHex: string;
	responseHex: string;
	responseStatus: string;
	dataText: string;
	statusHex: string;
	statusBytes: number[];
	elapsedMs: number;
	message?: string | null;
	error?: string | null;
	executedAt: string;
};

/**
 * Fetch за реалниот API: офлајн → FiscalBridgeOfflineError; HTTP грешка (409/500) →
 * FiscalBridgeError со читлива порака од телото (error/message/responseStatus).
 */
async function fiscalFetchReal<T>(path: string, options?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${FISCAL_BASE}${path}`, {
			headers: { 'Content-Type': 'application/json' },
			...options,
		});
	} catch {
		throw new FiscalBridgeOfflineError();
	}

	const text = await res.text().catch(() => '');
	let body: unknown = null;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = null;
	}

	if (!res.ok) {
		const cmd = body as Partial<FiscalCommandResult> | null;
		// ASP.NET ValidationProblemDetails: { errors: { field: [пораки] } }
		const validation = (body as { errors?: Record<string, string[]> } | null)?.errors;
		const validationMsg = validation ? Object.values(validation).flat().join(' ') : null;
		const msg = cmd?.error || cmd?.message || validationMsg || `FiscalBridge HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`;
		throw new FiscalBridgeError(msg, cmd?.responseStatus ?? String(res.status));
	}

	return body as T;
}

/** Една порака за секој вид фискална грешка — за toast/панел во UI. */
export function fiscalErrorMessage(err: unknown): string {
	if (err instanceof FiscalBridgeOfflineError) return err.message;
	if (err instanceof FiscalBridgeError) return err.message;
	if (err instanceof Error) return err.message;
	return String(err);
}

/** Чист/спремен уред: првите 4 статус бајти се 0x80 (нема error/busy битови). */
export function isDeviceStatusClean(statusBytes: number[]): boolean {
	return statusBytes.length >= 4 && statusBytes.slice(0, 4).every((b) => b === 0x80);
}

export type DiagnosticInfo = {
	model: string;
	firmware: string;
	checksum: string;
	switches: string;
	serialNumber: string;
	raw: string;
};

/** Парсирај diagnostic dataText: "SY55,354628 06Nov15 1800,5339,00000000,AC215101278". */
export function parseDiagnosticText(dataText: string): DiagnosticInfo {
	const parts = dataText.split(',').map((p) => p.trim());
	return {
		model: parts[0] ?? '',
		firmware: parts[1] ?? '',
		checksum: parts[2] ?? '',
		switches: parts[3] ?? '',
		serialNumber: parts[4] ?? '',
		raw: dataText,
	};
}

export const fiscalInfo = {
	/** GET /health — конфигурација на FiscalBridge (без сериска комуникација). */
	getHealth: () => fiscalFetchReal<FiscalHealth>('/health'),

	/** GET /ports — достапни COM портови на машината. */
	getPorts: () => fiscalFetchReal<string[]>('/ports'),

	/** GET /status — GET_STATUS_BYTES (0x4A) од уредот. */
	getDeviceStatus: () => fiscalFetchReal<FiscalCommandResult>('/status'),

	/** GET /diagnostic — GET_DIAGNOSTIC_INFORMATION (0x5A): модел/firmware/сериски. */
	getDiagnostic: () => fiscalFetchReal<FiscalCommandResult>('/diagnostic'),

	/** GET /date-time — GET_DATE_TIME (0x3E): датум/час на уредот (во dataText). */
	getDeviceDateTime: () => fiscalFetchReal<FiscalCommandResult>('/date-time'),

	/**
	 * POST /date-time/set — SET_DATE_TIME (0x3D). Празно тело = FiscalBridge го користи
	 * системското време на машината (иста машина = системски часовник) — идеално за синхронизација.
	 */
	setDeviceDateTime: async (dateTimeText?: string): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/date-time/set', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify(dateTimeText ? { dateTimeText } : {}),
		});
		return assertCommandSuccess(res);
	},
};

/** Парсирај фискален датум/час "DD-MM-YY hh:mm:ss" → Date, или null. */
export function parseFiscalDateTime(s: string): Date | null {
	const m = s.match(/(\d{2})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
	if (!m) return null;
	const [, dd, mm, yy, hh, min, ss] = m;
	return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
}

// ─── Артикли (фискална меморија) ──────────────────────────────────────────────
// GET /articles · GET /articles/read/{plu} · POST /articles/program · POST /articles/delete
// Сите бараат потврден header (програмирање/читање на фискална меморија).

export type FiscalArticle = {
	plu: number;
	name: string;
	price: number;
	vatGroup: string;
	department: number;
	group: number;
	priceType: number;
	quantity: number;
	barcode1: string;
	barcode2: string;
	barcode3: string;
	barcode4: string;
	programmed: boolean;
};

export type ProgramArticleInput = {
	plu: number;
	name: string;
	price: number;
	/** A=18%, B=5%, V=10%, G=0% */
	vatGroup: 'A' | 'B' | 'V' | 'G';
	department?: number;
	group?: number;
	priceType?: number;
	quantity?: number;
	barcode1?: string;
	barcode2?: string;
	barcode3?: string;
	barcode4?: string;
};

/** Ознаки за приказ на ДДВ групите од касата. */
export const VAT_GROUP_LABELS: Record<string, string> = {
	A: 'А (18%)',
	B: 'Б (5%)',
	V: 'В (10%)',
	G: 'Г (0%)',
};

const CONFIRM_HEADERS = {
	'Content-Type': 'application/json',
	'X-Fiscal-Print-Confirmation': 'I_UNDERSTAND_THIS_PRINTS_A_REAL_FISCAL_RECEIPT',
} as const;

/** Команда што мора да успее — инаку читлива грешка од одговорот на уредот. */
function assertCommandSuccess(res: FiscalCommandResult): FiscalCommandResult {
	if (res.success) return res;
	throw new FiscalBridgeError(res.error || res.message || `Командата не успеа (${res.responseStatus})`, res.responseStatus);
}

export const fiscalArticles = {
	/** GET /articles — ги чита СИТЕ програмирани артикли (артикал по артикал преку сериска — може да потрае). */
	getAll: () => fiscalFetchReal<FiscalArticle[]>('/articles', { headers: CONFIRM_HEADERS }),

	/** GET /articles/read/{plu} — чита еден артикал по PLU. */
	read: (plu: number) => fiscalFetchReal<FiscalArticle>(`/articles/read/${plu}`, { headers: CONFIRM_HEADERS }),

	/** POST /articles/program — програмира (создава/ажурира) артикал во касата. */
	program: async (input: ProgramArticleInput): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/articles/program', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmProgramming: true, ...input }),
		});
		return assertCommandSuccess(res);
	},

	/** POST /articles/delete — брише артикал по PLU. */
	remove: async (plu: number): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/articles/delete', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmProgramming: true, plu }),
		});
		return assertCommandSuccess(res);
	},
};

// ─── Извештаи + Кеш (реален контракт) ─────────────────────────────────────────
// POST /reports/x · /reports/z · /reports/fm-date · /cash/in · /cash/out
// Сите печатат на уредот → задолжителен confirmPrint + header.

export const fiscalReports = {
	/** POST /reports/x — контролен извештај (ПРОШИРЕН), без затворање на ден. */
	printX: async (): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/reports/x', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true }),
		});
		return assertCommandSuccess(res);
	},

	/** POST /reports/z — дневен фискален извештај (ЗАТВОРАЊЕ на ден, неповратно). */
	printZ: async (): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/reports/z', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true }),
		});
		return assertCommandSuccess(res);
	},

	/** POST /reports/fm-date — фискална меморија од дата до дата (краток/детален). */
	printFmDate: async (input: { from: string; to: string; detailed: boolean }): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/reports/fm-date', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true, ...input }),
		});
		return assertCommandSuccess(res);
	},
};

export const fiscalCash = {
	/** POST /cash/in — готово влезно (внес готовина). */
	cashIn: async (amount: number, reason?: string): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/cash/in', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true, amount, reason }),
		});
		return assertCommandSuccess(res);
	},

	/** POST /cash/out — готово излезно (изнес готовина). */
	cashOut: async (amount: number, reason?: string): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/cash/out', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true, amount, reason }),
		});
		return assertCommandSuccess(res);
	},
};

// ─── Фискална сметка: продажба + сторно (реален контракт) ─────────────────────
// POST /receipt/open · /receipt/sale · /receipt/payment · /receipt/close · /receipt/cancel
// POST /receipt/storno (оркестрирано: void open → ставки → плаќање → close во еден повик)

export type VatGroupLetter = 'A' | 'B' | 'V' | 'G';

/** ДДВ процент од products (18/5/10/null) → фискална група. */
export function taxPercentToVatGroup(taxPercent: number | null | undefined): VatGroupLetter {
	switch (taxPercent) {
		case 18:
			return 'A';
		case 5:
			return 'B';
		case 10:
			return 'V';
		default:
			return 'G';
	}
}

/** Фискален код 1-4 (fiscal_receipt_items.tax_group) → фискална група. */
export function taxCodeToVatGroup(taxCode: number | null | undefined): VatGroupLetter {
	switch (taxCode) {
		case 1:
			return 'A';
		case 2:
			return 'B';
		case 3:
			return 'V';
		default:
			return 'G';
	}
}

export type FiscalSaleLine = {
	description: string;
	vatGroup: VatGroupLetter;
	price: number;
	quantity: number;
	macedonianItem: boolean;
	/** NONE | DISCOUNT_VALUE | DISCOUNT_PERCENT | SURCHARGE_VALUE | SURCHARGE_PERCENT */
	priceCorrectionType?: string;
	priceCorrectionValue?: number;
};

export type FiscalPaymentName = 'Cash' | 'Debit' | 'Credit' | 'Check';

export type FiscalStornoResponse = {
	openResult: FiscalCommandResult | null;
	saleResults: FiscalCommandResult[];
	paymentResult: FiscalCommandResult | null;
	closeResult: FiscalCommandResult | null;
	overallSuccess: boolean;
	elapsedMs: number;
};

/** Најди ја пораката од првиот неуспешен чекор во оркестриран одговор. */
function stornoFailureMessage(res: Partial<FiscalStornoResponse> | null): string {
	const steps = [res?.openResult, ...(res?.saleResults ?? []), res?.paymentResult, res?.closeResult];
	for (const s of steps) {
		if (s && !s.success) return s.error || s.message || `Чекор ${s.commandName} не успеа (${s.responseStatus}).`;
	}
	return 'Сторно операцијата не успеа.';
}

export const fiscalReceipt = {
	/** Отвори сметка (storno=true за void/сторно сметка). */
	open: async (storno = false): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/receipt/open', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true, storno }),
		});
		return assertCommandSuccess(res);
	},

	/** Регистрирај една ставка (позитивна цена/количина; попуст преку correction полињата). */
	sale: async (line: FiscalSaleLine): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/receipt/sale', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true, ...line }),
		});
		return assertCommandSuccess(res);
	},

	/** Плаќање: Cash=кеш, Debit=картичка, Credit, Check. */
	payment: async (paymentMethod: FiscalPaymentName, amount: number): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/receipt/payment', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true, paymentMethod, amount }),
		});
		return assertCommandSuccess(res);
	},

	/** Затвори сметка (иста команда за нормална и сторно на каса). */
	close: async (storno = false): Promise<FiscalCommandResult> => {
		const res = await fiscalFetchReal<FiscalCommandResult>('/receipt/close', {
			method: 'POST',
			headers: CONFIRM_HEADERS,
			body: JSON.stringify({ confirmPrint: true, storno }),
		});
		return assertCommandSuccess(res);
	},

	/** Откажи заглавена/полуотворена сметка (recovery, 0x3C). Не фрла — best effort. */
	cancel: async (): Promise<FiscalCommandResult | null> => {
		try {
			return await fiscalFetchReal<FiscalCommandResult>('/receipt/cancel', {
				method: 'POST',
				headers: CONFIRM_HEADERS,
				body: JSON.stringify({ confirmPrint: true }),
			});
		} catch {
			return null;
		}
	},

	/** СТОРНО — цела void сметка во еден повик (open flag=1 → ставки → плаќање → close). */
	storno: async (input: { items: FiscalSaleLine[]; paymentMethod: FiscalPaymentName; amount: number }): Promise<FiscalStornoResponse> => {
		let res: Response;
		try {
			res = await fetch(`${FISCAL_BASE}/receipt/storno`, {
				method: 'POST',
				headers: CONFIRM_HEADERS,
				body: JSON.stringify({ confirmPrint: true, ...input }),
			});
		} catch {
			throw new FiscalBridgeOfflineError();
		}

		const body = (await res.json().catch(() => null)) as FiscalStornoResponse | null;
		if (!res.ok || !body || !body.overallSuccess) {
			throw new FiscalBridgeError(stornoFailureMessage(body), String(res.status));
		}
		return body;
	},
};

/** Извади број на сметка (slip no) од close одговорот, ако уредот вратил. */
export function parseSlipNumber(res: FiscalCommandResult | null | undefined): number | null {
	const m = res?.dataText?.match(/\d{1,10}/);
	return m ? Number.parseInt(m[0], 10) : null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Truncate product name to 32 chars (SY55 PluName limit per Command 49h). */
export function truncateFiscalName(name: string, maxLen = 32): string {
	return name.length > maxLen ? name.slice(0, maxLen) : name;
}
