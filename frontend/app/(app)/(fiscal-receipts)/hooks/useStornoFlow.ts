'use client';

import { api } from 'app/lib/api-client';
import { toast } from 'sonner';
import {
	FiscalBridgeOfflineError,
	type FiscalSaleLine,
	fiscalErrorMessage,
	fiscalInfo,
	fiscalReceipt,
	isDeviceStatusClean,
	parseSlipNumber,
	taxCodeToVatGroup,
	truncateFiscalName,
} from 'app/lib/fiscal-bridge';

export type StornoFlowItem = {
	/** ID of the original fiscal_receipt_items row */
	originalItemId: string;
	quantity: number;
	productName: string | null;
	unitPrice: number;
	/** tax_group from DB — already is the fiscal tax code (1-4) */
	taxGroup: number | null;
	isMacedonian: boolean;
};

export type StornoFlowArgs = {
	originalReceiptId: string;
	items: StornoFlowItem[];
	total: number;
	payment: 'CASH' | 'CARD';
	storeNo: number | null;
	createdBy: string | null;
};

export type StornoFlowResult = {
	stornoReceiptId: string;
	fiscalSlipNo: number | null;
};

/** Сторно ставка од базата → фискална ставка (позитивни вредности, како Java void receipt). */
const toFiscalLine = (item: StornoFlowItem): FiscalSaleLine => ({
	description: truncateFiscalName(item.productName ?? 'Производ', 20),
	vatGroup: taxCodeToVatGroup(item.taxGroup),
	price: item.unitPrice,
	quantity: item.quantity,
	macedonianItem: item.isMacedonian,
});

export const useStornoFlow = () => {
	const runStornoFlow = async (args: StornoFlowArgs): Promise<StornoFlowResult> => {
		const { originalReceiptId, items, total, payment, storeNo, createdBy } = args;
		const fiscalPayment = payment === 'CASH' ? 'Cash' : 'Debit';

		// ── Helper to persist storno result to backend regardless of fiscal outcome ──
		const saveStornoResult = async (
			fiscalStatus: 'success' | 'failed' | 'offline',
			fiscalSlipNo: number | null,
			fiscalError: string | null,
			bridgeResponse: string | null,
		): Promise<StornoFlowResult> => {
			const body = {
				items: items.map((i) => ({
					original_item_id: i.originalItemId,
					quantity: i.quantity,
				})),
				payment,
				fiscal_slip_no: fiscalSlipNo,
				fiscal_status: fiscalStatus,
				fiscal_error: fiscalError,
				bridge_response: bridgeResponse,
				total,
				store_no: storeNo,
				created_by: createdBy,
			};
			const result = await api.post<{ id: string }>(`/api/fiscal-receipts/${originalReceiptId}/storno`, body);
			return { stornoReceiptId: result.id, fiscalSlipNo };
		};

		// ── 1. Провери уред ────────────────────────────────────────────────────────
		let deviceStatus: Awaited<ReturnType<typeof fiscalInfo.getDeviceStatus>>;
		try {
			deviceStatus = await fiscalInfo.getDeviceStatus();
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.warning('Сторно е зачувано, но фискалниот уред е офлајн. Ќе треба рачна фискализација.', { duration: 8000 });
				return saveStornoResult('offline', null, 'bridge offline', null);
			}
			toast.warning('Сторно е зачувано, но фискалниот уред не е достапен.', { duration: 8000 });
			return saveStornoResult('offline', null, fiscalErrorMessage(err), null);
		}

		if (!deviceStatus.success) {
			toast.warning('Фискалниот уред не одговара. Сторно е зачувано — фискализирај рачно.', { duration: 8000 });
			return saveStornoResult('offline', null, deviceStatus.error || deviceStatus.responseStatus, null);
		}

		// ── 2. Pre-clean: заглавена отворена сметка → откажи (best effort) ─────────
		if (!isDeviceStatusClean(deviceStatus.statusBytes)) {
			await fiscalReceipt.cancel();
		}

		try {
			// ── 3. СТОРНО во еден оркестриран повик:
			//       OPEN(void flag=1) → ставки (позитивни) → плаќање → CLOSE
			const res = await fiscalReceipt.storno({
				items: items.map(toFiscalLine),
				paymentMethod: fiscalPayment,
				amount: total,
			});

			const slipNo = parseSlipNumber(res.closeResult);
			const bridgeResponse = JSON.stringify({
				open: res.openResult?.responseStatus,
				sales: res.saleResults.map((s) => s.responseStatus),
				payment: res.paymentResult?.responseStatus,
				close: res.closeResult?.responseStatus,
				elapsedMs: res.elapsedMs,
			});

			// ── 4. Persist to backend ─────────────────────────────────────────────
			const result = await saveStornoResult('success', slipNo, null, bridgeResponse);

			toast.success(`Сторно сметка${slipNo ? ` #${slipNo}` : ''} испечатена.`, { duration: 4000 });
			return result;
		} catch (err) {
			// Recovery: не оставај полуотворена void сметка (best effort).
			await fiscalReceipt.cancel();

			if (err instanceof FiscalBridgeOfflineError) {
				toast.warning('Фискалниот уред се исклучи при сторно. Зачувано во базата.', { duration: 8000 });
				return saveStornoResult('offline', null, 'bridge disconnected mid-storno', null);
			}

			const msg = fiscalErrorMessage(err);
			toast.error(`Грешка при сторно: ${msg}. Зачувано во базата.`, { duration: 10000 });
			return saveStornoResult('failed', null, msg, null);
		}
	};

	return { runStornoFlow };
};
