'use client';

import { supabase } from 'app/lib/supabase-client';
import { toast } from 'sonner';
import { fiscalBridge, FiscalBridgeOfflineError, toFiscalTaxCode, toFiscalPaymentMode, truncateFiscalName } from 'app/lib/fiscal-bridge';
import type { CartItem, Totals } from '../types';
import { num, priceNum, clampFinalToBase } from '../utils';

type FiscalSaleArgs = {
	receiptId: string;
	cart: CartItem[];
	totals: Totals;
	paymentMethod: 'CASH' | 'CARD';
};

/**
 * Updates the sales_receipts row with fiscal slip data.
 * Called after a successful fiscal flow OR to record a failure.
 */
const saveFiscalResult = async (
	receiptId: string,
	patch: {
		fiscal_slip_no?: number | null;
		fiscal_status: 'ok' | 'failed' | 'offline';
		fiscal_error?: string | null;
	},
) => {
	await supabase
		.from('sales_receipts')
		.update({
			fiscal_slip_no: patch.fiscal_slip_no ?? null,
			fiscal_status: patch.fiscal_status,
			fiscal_synced_at: new Date().toISOString(),
			fiscal_error: patch.fiscal_error ?? null,
		})
		.eq('id', receiptId);
};

export const useFiscalSaleFlow = () => {
	/**
	 * Run the complete fiscal flow for a sale.
	 *
	 * This should be called AFTER the DB save succeeds (receiptId is the
	 * sales_receipts.id returned from useSalesSubmit).
	 *
	 * On FiscalBridgeOfflineError → shows a dismissible warning toast (sale is
	 * already saved in DB so no data is lost).
	 *
	 * On any other fiscal error → shows an error toast and saves the error
	 * message back to the DB row for later reconciliation.
	 */
	const runFiscalSale = async (args: FiscalSaleArgs): Promise<void> => {
		const { receiptId, cart, totals, paymentMethod } = args;

		// 1 ─ Check device is reachable ──────────────────────────────────────────
		let status: Awaited<ReturnType<typeof fiscalBridge.getStatus>>;
		try {
			status = await fiscalBridge.getStatus();
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.warning(
					'Продажбата е зачувана, но фискалниот уред е офлајн. Ќе треба рачна фискализација.',
					{ duration: 8000 },
				);
				await saveFiscalResult(receiptId, { fiscal_status: 'offline', fiscal_error: 'bridge offline' });
				return;
			}
			throw err;
		}

		if (!status.IsConnected) {
			toast.warning('Фискалниот уред е исклучен. Продажбата е зачувана — фискализирај рачно.', { duration: 8000 });
			await saveFiscalResult(receiptId, { fiscal_status: 'offline', fiscal_error: 'device not connected' });
			return;
		}

		// 2 ─ Check for stale open receipt ───────────────────────────────────────
		try {
			const txStatus = await fiscalBridge.getTransactionStatus();
			if (txStatus.IsOpen) {
				// Attempt to close it silently before opening a new one
				await fiscalBridge.closeReceipt().catch(() => null);
			}
		} catch {
			// Non-blocking — proceed
		}

		try {
			// 3 ─ Open receipt ────────────────────────────────────────────────────
			const opened = await fiscalBridge.openReceipt({
				opCode: '1',
				opPwd: '0000',
				storno: 0,
			});

			// 4 ─ Register all line items ─────────────────────────────────────────
			for (const item of cart) {
				const base = num(item.product.selling_price);
				const finalRaw = priceNum(item.finalPriceStr);
				const finalPrice = clampFinalToBase(finalRaw, base);
				const discountAmount = base > finalPrice ? Math.round((base - finalPrice) * item.qty * 100) / 100 : undefined;

				await fiscalBridge.registerSale({
					pluName: truncateFiscalName(item.product.name),
					taxCode: toFiscalTaxCode(item.product.tax_group),
					price: base,
					quantity: item.qty,
					...(discountAmount !== undefined ? { discountType: 4, discountValue: discountAmount } : {}),
				});
			}

			// 5 ─ Subtotal (display only) ─────────────────────────────────────────
			await fiscalBridge.subtotal({ print: 0, display: 1 }).catch(() => null);

			// 6 ─ Payment ─────────────────────────────────────────────────────────
			await fiscalBridge.payment({
				paidMode: toFiscalPaymentMode(paymentMethod),
				amount: totals.total,
			});

			// 7 ─ Close receipt ───────────────────────────────────────────────────
			const closed = await fiscalBridge.closeReceipt();

			const slipNo = closed.SlipNumber ?? opened.SlipNumber ?? null;

			// 8 ─ Persist slip number back to DB ─────────────────────────────────
			await saveFiscalResult(receiptId, {
				fiscal_slip_no: slipNo,
				fiscal_status: 'ok',
			});

			toast.success(`Фискален сметки #${slipNo ?? '—'} испечатен.`, { duration: 4000 });
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.warning('Фискалниот уред се исклучи во текот на продажбата. Зачувана е во DB.', { duration: 8000 });
				await saveFiscalResult(receiptId, { fiscal_status: 'offline', fiscal_error: 'bridge disconnected mid-sale' });
				return;
			}

			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Грешка при фискализација: ${msg}. Продажбата е зачувана во базата.`, { duration: 10000 });
			await saveFiscalResult(receiptId, { fiscal_status: 'failed', fiscal_error: msg });
		}
	};

	return { runFiscalSale };
};
