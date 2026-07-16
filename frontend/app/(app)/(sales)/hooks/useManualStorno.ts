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
	taxPercentToFiscalCode,
	taxPercentToVatGroup,
	truncateFiscalName,
} from 'app/lib/fiscal-bridge';
import type { CartItem, Totals } from '../types';
import { clampFinalToBase, num, priceNum, round2 } from '../utils';

type ManualStornoArgs = {
	cart: CartItem[];
	totals: Totals;
	paymentMethod: 'CASH' | 'CARD';
};

/** Финална (нето) единечна цена по ставка — што реално се сторнира. */
const finalUnitPrice = (item: CartItem): number => {
	const base = num(item.product.selling_price);
	return clampFinalToBase(priceNum(item.finalPriceStr), base);
};

const toDeviceLine = (item: CartItem): FiscalSaleLine => ({
	description: truncateFiscalName(item.product.name, 20),
	vatGroup: taxPercentToVatGroup(item.product.tax_group),
	price: finalUnitPrice(item),
	quantity: item.qty,
	macedonianItem: item.product.is_macedonian === true,
});

/**
 * Рачно (ad-hoc) сторно — void сметка за оригинал што НЕ е во базата
 * (пр. рачно испечатена на каса). Печати void сметка + запишува во база (враќа залиха),
 * без референца на оригинал (како Java void receipt).
 */
export const useManualStorno = () => {
	const runManualStorno = async ({ cart, totals, paymentMethod }: ManualStornoArgs): Promise<boolean> => {
		if (cart.length === 0) {
			toast.error('Кошничката е празна.');
			return false;
		}

		const fiscalPayment = paymentMethod === 'CASH' ? 'Cash' : 'Debit';

		const persist = (fiscalStatus: 'success' | 'failed' | 'offline', slipNo: number | null, error: string | null, bridge: string | null) =>
			api.post<{ id: string }>('/api/fiscal-receipts/manual-storno', {
				items: cart.map((item) => ({
					product_id: item.product.id,
					product_name: item.product.name,
					quantity: item.qty,
					unit_price: finalUnitPrice(item),
					tax_group: taxPercentToFiscalCode(item.product.tax_group),
					tax_percent: item.product.tax_group ?? 0,
					is_macedonian: item.product.is_macedonian === true,
					plu: item.product.plu ?? null,
				})),
				payment: paymentMethod,
				fiscal_status: fiscalStatus,
				fiscal_slip_no: slipNo,
				fiscal_error: error,
				bridge_response: bridge,
				store_no: null,
			});

		// 1 ─ Провери уред ────────────────────────────────────────────────────
		let deviceStatus: Awaited<ReturnType<typeof fiscalInfo.getDeviceStatus>>;
		try {
			deviceStatus = await fiscalInfo.getDeviceStatus();
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн — сторно не е испечатено.');
			} else {
				toast.error(`Фискалниот уред не е достапен: ${fiscalErrorMessage(err)}`);
			}
			return false;
		}

		if (!deviceStatus.success) {
			toast.error(`Касата не одговара: ${deviceStatus.error || deviceStatus.responseStatus}`);
			return false;
		}

		// 2 ─ Pre-clean: заглавена сметка → откажи (best effort) ────────────────
		if (!isDeviceStatusClean(deviceStatus.statusBytes)) {
			await fiscalReceipt.cancel();
		}

		try {
			// 3 ─ Void сметка на касата (open flag=1 → ставки → плаќање → close)
			const res = await fiscalReceipt.storno({
				items: cart.map(toDeviceLine),
				paymentMethod: fiscalPayment,
				amount: round2(totals.total),
			});

			const slipNo = parseSlipNumber(res.closeResult);
			const bridge = JSON.stringify({
				open: res.openResult?.responseStatus,
				sales: res.saleResults.map((s) => s.responseStatus),
				payment: res.paymentResult?.responseStatus,
				close: res.closeResult?.responseStatus,
			});

			await persist('success', slipNo, null, bridge);
			toast.success(`Рачно сторно${slipNo ? ` #${slipNo}` : ''} испечатено.`, { duration: 4000 });
			return true;
		} catch (err) {
			await fiscalReceipt.cancel(); // recovery — не оставај полуотворена void сметка

			const msg = fiscalErrorMessage(err);
			toast.error(`Грешка при рачно сторно: ${msg}`, { duration: 10000 });
			// Не запишуваме во база при неуспех — нема испечатена сметка на касата.
			return false;
		}
	};

	return { runManualStorno };
};
