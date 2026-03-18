'use client';

import { api } from 'app/lib/api-client';
import { toast } from 'sonner';
import type { CartItem, Totals } from '../types';
import { num, priceNum, clampFinalToBase, discountPerUnitFromBaseFinal, sanitizePriceInput } from '../utils';

type SubmitArgs = {
	cart: CartItem[];
	totals: Totals;
	note: string;
	paymentMethod: 'CASH' | 'CARD';
	cashReceivedStr: string;
	onSuccess?: () => void;
};

export type SubmitResult = {
	receiptId: string;
	receiptNo: number;
};

type SaleResponse = {
	receipt: {
		id: string;
		receipt_no: number;
		payment: string;
		total: number;
		cash_received: number | null;
		created_at: string;
	};
	stock_warnings: string[];
};

export const useSalesSubmit = () => {
	const submitSale = async (args: SubmitArgs): Promise<SubmitResult> => {
		const { cart, totals, note, paymentMethod, cashReceivedStr, onSuccess } = args;

		if (cart.length === 0) {
			toast.error('Кошничката е празна.');
			throw new Error('empty-cart');
		}

		let cashReceived: number | null = null;
		if (paymentMethod === 'CASH') {
			cashReceived = priceNum(sanitizePriceInput(cashReceivedStr || '0'));
			if (cashReceived < totals.total) {
				toast.error(`Недоволно готово. Вкупно: ${totals.total.toFixed(2)} ден. / Дава: ${cashReceived.toFixed(2)} ден.`);
				throw new Error('insufficient-cash');
			}
		}

		const items = cart.map((item) => {
			const base = num(item.product.selling_price);
			const finalRaw = priceNum(item.finalPriceStr);
			const final = clampFinalToBase(finalRaw, base);
			const discountPerUnit = discountPerUnitFromBaseFinal(base, final);

			return {
				product_id: item.product.id,
				qty:        item.qty,
				base_price: base,
				price:      final,
				discount:   discountPerUnit,
			};
		});

		const data = await api.post<SaleResponse>('/api/sales', {
			payment:       paymentMethod,
			total:         totals.total,
			cash_received: cashReceived,
			note:          note?.trim() || null,
			items,
		});

		const { receipt, stock_warnings } = data;

		// Show stock warnings from the server (non-blocking — same behaviour as before)
		for (const w of stock_warnings ?? []) {
			toast.warning(`Внимание: ${w}`);
		}

		if (paymentMethod === 'CASH') {
			const change = (cashReceived ?? 0) - totals.total;
			toast.success(`Продажба зачувана ✅ (#${receipt.receipt_no}) • Готово • Кусур: ${change.toFixed(2)} ден.`);
		} else {
			toast.success(`Продажба зачувана ✅ (#${receipt.receipt_no}) • Картичка`);
		}

		onSuccess?.();

		return { receiptId: receipt.id, receiptNo: receipt.receipt_no };
	};

	return { submitSale };
};
