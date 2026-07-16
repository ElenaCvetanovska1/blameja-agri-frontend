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
	taxPercentToVatGroup,
	truncateFiscalName,
} from 'app/lib/fiscal-bridge';
import type { CartItem, Totals } from '../types';
import { num, priceNum, clampFinalToBase } from '../utils';

type FiscalSaleArgs = {
	receiptId: string;
	cart: CartItem[];
	totals: Totals;
	paymentMethod: 'CASH' | 'CARD';
};

/** Persists fiscal device result to the backend: PATCH /api/sales/{receiptId}/fiscal */
const saveFiscalResult = async (
	receiptId: string,
	patch: {
		fiscal_slip_no?: number | null;
		fiscal_status: 'success' | 'failed' | 'offline';
		fiscal_error?: string | null;
	},
) => {
	await api.patch(`/api/sales/${receiptId}/fiscal`, {
		fiscal_slip_no: patch.fiscal_slip_no ?? null,
		fiscal_status: patch.fiscal_status,
		fiscal_error: patch.fiscal_error ?? null,
		fiscal_synced_at: new Date().toISOString(),
	});
};

/** Кошничка ставка → фискална ставка (каса формат преку FiscalBridge). */
const toFiscalLine = (item: CartItem): FiscalSaleLine => {
	const base = num(item.product.selling_price);
	const finalRaw = priceNum(item.finalPriceStr);
	const finalPrice = clampFinalToBase(finalRaw, base);
	// Попуст како ИЗНОС за целата ставка: (основна − финална) × количина.
	const discountAmount = base > finalPrice ? Math.round((base - finalPrice) * item.qty * 100) / 100 : 0;

	return {
		description: truncateFiscalName(item.product.name, 20),
		vatGroup: taxPercentToVatGroup(item.product.tax_group),
		price: base,
		quantity: item.qty,
		macedonianItem: item.product.is_macedonian === true,
		...(discountAmount > 0 ? { priceCorrectionType: 'DISCOUNT_VALUE', priceCorrectionValue: discountAmount } : {}),
	};
};

export const useFiscalSaleFlow = () => {
	const runFiscalSale = async (args: FiscalSaleArgs): Promise<void> => {
		const { receiptId, cart, totals, paymentMethod } = args;
		const fiscalPayment = paymentMethod === 'CASH' ? 'Cash' : 'Debit';

		// 1 ─ Провери дали уредот е достапен и спремен ───────────────────────────
		let deviceStatus: Awaited<ReturnType<typeof fiscalInfo.getDeviceStatus>>;
		try {
			deviceStatus = await fiscalInfo.getDeviceStatus();
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.warning('Продажбата е зачувана, но фискалниот уред е офлајн. Ќе треба рачна фискализација.', { duration: 8000 });
				await saveFiscalResult(receiptId, { fiscal_status: 'offline', fiscal_error: 'bridge offline' });
				return;
			}
			toast.warning('Продажбата е зачувана, но фискалниот уред не е достапен. Ќе треба рачна фискализација.', { duration: 8000 });
			await saveFiscalResult(receiptId, { fiscal_status: 'offline', fiscal_error: fiscalErrorMessage(err) });
			return;
		}

		if (!deviceStatus.success) {
			toast.warning('Фискалниот уред не одговара. Продажбата е зачувана — фискализирај рачно.', { duration: 8000 });
			await saveFiscalResult(receiptId, {
				fiscal_status: 'offline',
				fiscal_error: deviceStatus.error || deviceStatus.responseStatus,
			});
			return;
		}

		// 2 ─ Pre-clean: заглавена отворена сметка → откажи (best effort, како Java pre-clean)
		if (!isDeviceStatusClean(deviceStatus.statusBytes)) {
			await fiscalReceipt.cancel();
		}

		try {
			// 3 ─ Отвори сметка ──────────────────────────────────────────────────
			await fiscalReceipt.open(false);

			// 4 ─ Ставки (позитивни; попуст преку correction) ────────────────────
			for (const item of cart) {
				await fiscalReceipt.sale(toFiscalLine(item));
			}

			// 5 ─ Плаќање ────────────────────────────────────────────────────────
			await fiscalReceipt.payment(fiscalPayment, totals.total);

			// 6 ─ Затвори ────────────────────────────────────────────────────────
			const closed = await fiscalReceipt.close(false);
			const slipNo = parseSlipNumber(closed);

			// 7 ─ Зачувај резултат ───────────────────────────────────────────────
			await saveFiscalResult(receiptId, { fiscal_slip_no: slipNo, fiscal_status: 'success' });
			toast.success(`Фискална сметка${slipNo ? ` #${slipNo}` : ''} испечатена.`, { duration: 4000 });
		} catch (err) {
			// Recovery: не оставај полуотворена сметка на уредот (best effort).
			await fiscalReceipt.cancel();

			if (err instanceof FiscalBridgeOfflineError) {
				toast.warning('Фискалниот уред се исклучи во текот на продажбата. Зачувана е во базата.', { duration: 8000 });
				await saveFiscalResult(receiptId, { fiscal_status: 'offline', fiscal_error: 'bridge disconnected mid-sale' });
				return;
			}

			const msg = fiscalErrorMessage(err);
			toast.error(`Грешка при фискализација: ${msg}. Продажбата е зачувана во базата.`, { duration: 10000 });
			await saveFiscalResult(receiptId, { fiscal_status: 'failed', fiscal_error: msg });
		}
	};

	return { runFiscalSale };
};
