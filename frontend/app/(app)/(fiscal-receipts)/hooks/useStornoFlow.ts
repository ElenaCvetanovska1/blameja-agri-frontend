'use client';

import { api } from 'app/lib/api-client';
import { toast } from 'sonner';
import {
	fiscalBridge,
	FiscalBridgeOfflineError,
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

const toFiscalTaxCodeFromGroup = (taxGroup: number | null | undefined): 1 | 2 | 3 | 4 => {
	// tax_group in DB is already the fiscal code (1=A/18%, 2=Б/5%, 3=В/10%, 4=Г/0%)
	if (taxGroup === 1 || taxGroup === 2 || taxGroup === 3 || taxGroup === 4) return taxGroup;
	return 4; // default to exempt
};

export const useStornoFlow = () => {
	const runStornoFlow = async (args: StornoFlowArgs): Promise<StornoFlowResult> => {
		const { originalReceiptId, items, total, payment, storeNo, createdBy } = args;

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
			const result = await api.post<{ id: string }>(
				`/api/fiscal-receipts/${originalReceiptId}/storno`,
				body,
			);
			return { stornoReceiptId: result.id, fiscalSlipNo };
		};

		// ── 1. Check device reachability ──────────────────────────────────────────
		let status: Awaited<ReturnType<typeof fiscalBridge.getStatus>>;
		try {
			status = await fiscalBridge.getStatus();
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.warning('Сторно е зачувано, но фискалниот уред е офлајн. Ќе треба рачна фискализација.', { duration: 8000 });
				return saveStornoResult('offline', null, 'bridge offline', null);
			}
			throw err;
		}

		if (!status.IsConnected) {
			toast.warning('Фискалниот уред е исклучен. Сторно е зачувано — фискализирај рачно.', { duration: 8000 });
			return saveStornoResult('offline', null, 'device not connected', null);
		}

		// ── 2. Close any stale open receipt ───────────────────────────────────────
		try {
			const txStatus = await fiscalBridge.getTransactionStatus();
			if (txStatus.IsOpen) {
				await fiscalBridge.closeReceipt().catch(() => null);
			}
		} catch {
			// Non-blocking — proceed
		}

		try {
			// ── 3. Open storno receipt (storno: 1) ────────────────────────────────
			const opened = await fiscalBridge.openReceipt({
				opCode: '1',
				opPwd: '0000',
				storno: 1,
			});

			// ── 4. Register each storno line item ─────────────────────────────────
			for (const item of items) {
				await fiscalBridge.registerSale({
					pluName: truncateFiscalName(item.productName ?? 'Производ'),
					taxCode: toFiscalTaxCodeFromGroup(item.taxGroup),
					price: item.unitPrice,
					quantity: item.quantity,
					isMacedonian: item.isMacedonian ? 1 : 0,
				});
			}

			// ── 5. Subtotal (display only) ────────────────────────────────────────
			await fiscalBridge.subtotal({ print: 0, display: 1 }).catch(() => null);

			// ── 6. Payment (refund) ───────────────────────────────────────────────
			const paidMode = payment === 'CASH' ? 0 : 1;
			const paymentRes = await fiscalBridge.payment({ paidMode, amount: total });

			// ── 7. Close receipt ──────────────────────────────────────────────────
			const closed = await fiscalBridge.closeReceipt();

			const slipNo = closed.SlipNumber ?? opened.SlipNumber ?? null;
			const bridgeResponse = JSON.stringify({ opened, paymentRes, closed });

			// ── 8. Persist to backend ─────────────────────────────────────────────
			const result = await saveStornoResult('success', slipNo, null, bridgeResponse);

			toast.success(`Сторно сметка #${slipNo ?? '—'} испечатена.`, { duration: 4000 });
			return result;
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.warning('Фискалниот уред се исклучи при сторно. Зачувано во DB.', { duration: 8000 });
				return saveStornoResult('offline', null, 'bridge disconnected mid-storno', null);
			}

			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Грешка при сторно: ${msg}. Зачувано во базата.`, { duration: 10000 });
			return saveStornoResult('failed', null, msg, null);
		}
	};

	return { runStornoFlow };
};
