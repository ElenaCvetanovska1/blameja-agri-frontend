'use client';

import { api } from 'app/lib/api-client';
import { toast } from 'sonner';
import type { CartItem, Totals } from '../types';
import { num, priceNum, round2, discountPerUnitFromBaseFinal, sanitizePriceInput } from '../utils';

type SubmitArgs = {
	cart: CartItem[];
	totals: Totals;
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
		const { cart, totals, paymentMethod, cashReceivedStr, onSuccess } = args;

		if (cart.length === 0) {
			toast.error('Кошничката е празна.');
			throw new Error('empty-cart');
		}

		// „Прима готово" е ОПЦИОНАЛНО: празно = точен износ. Ако е внесено, мора да покрива.
		let cashReceived: number | null = null;
		if (paymentMethod === 'CASH' && cashReceivedStr.trim().length > 0) {
			cashReceived = priceNum(sanitizePriceInput(cashReceivedStr));
			if (cashReceived < totals.total) {
				toast.error(`Недоволно готово. Вкупно: ${totals.total.toFixed(2)} ден. / Дава: ${cashReceived.toFixed(2)} ден.`);
				throw new Error('insufficient-cash');
			}
		}

		const items = cart.map((item) => {
			const base = num(item.product.selling_price);
			// Повисока цена од основната е дозволена → таа станува основа (попуст 0, без + процент).
			const final = priceNum(item.finalPriceStr);
			const discountPerUnit = discountPerUnitFromBaseFinal(base, final);

			return {
				product_id: item.product.id,
				qty: item.qty,
				base_price: round2(Math.max(base, final)),
				price: final,
				discount: discountPerUnit,
			};
		});

		const data = await api.post<SaleResponse>('/api/sales', {
			payment: paymentMethod,
			total: totals.total,
			cash_received: cashReceived,
			note: null,
			items,
		});

		const { receipt, stock_warnings } = data;

		// Show stock warnings from the server (non-blocking — same behaviour as before)
		for (const w of stock_warnings ?? []) {
			toast.warning(`Внимание: ${w}`);
		}

		if (paymentMethod === 'CASH') {
			// Кусур се прикажува само ако е внесено „прима готово".
			const changeInfo = cashReceived != null ? ` • Кусур: ${(cashReceived - totals.total).toFixed(2)} ден.` : '';
			toast.success(`Продажба зачувана ✅ (#${receipt.receipt_no}) • Готово${changeInfo}`);
		} else {
			toast.success(`Продажба зачувана ✅ (#${receipt.receipt_no}) • Картичка`);
		}

		onSuccess?.();

		return { receiptId: receipt.id, receiptNo: receipt.receipt_no };
	};

	return { submitSale };
};
