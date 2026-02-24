'use client';

import { supabase } from 'app/lib/supabase-client';
import { toast } from 'sonner';
import type { CartItem, Totals } from '../types';
import {
	num,
	priceNum,
	clampFinalToBase,
	discountPerUnitFromBaseFinal,
	sanitizePriceInput,
} from '../utils';

type SubmitArgs = {
	cart: CartItem[];
	totals: Totals;
	note: string;
	paymentMethod: 'CASH' | 'CARD';
	cashReceivedStr: string; // внес од UI (TotalsPanel)
	onSuccess?: () => void;
};

export const useSalesSubmit = () => {
	const submitSale = async (args: SubmitArgs) => {
		const { cart, totals, note, paymentMethod, cashReceivedStr, onSuccess } = args;

		if (cart.length === 0) {
			toast.error('Кошничката е празна.');
			return;
		}

		// ✅ CASH: провери дали дава доволно пари (ова си останува)
		let cashReceived: number | null = null;
		if (paymentMethod === 'CASH') {
			cashReceived = priceNum(sanitizePriceInput(cashReceivedStr || '0'));
			if (cashReceived < totals.total) {
				toast.error(
					`Недоволно готово. Вкупно: ${totals.total.toFixed(2)} ден. / Дава: ${cashReceived.toFixed(2)} ден.`
				);
				return;
			}
		}

		/**
		 * ✅ IMPORTANT CHANGE:
		 * - НЕ блокира продажба ако нема доволно залиха.
		 * - Само покажува warning ако ќе оди во минус.
		 */
		for (const item of cart) {
			const { data, error } = await supabase
				.from('product_stock')
				.select('qty_on_hand')
				.eq('product_id', item.product.id)
				.maybeSingle();

			if (error) throw error;

			const available = num((data as any)?.qty_on_hand);
			if (available < item.qty) {
				const deficit = item.qty - available;
				toast.warning(
					`Внимание: "${item.product.name}" нема доволно залиха. Достапно: ${available}, бараш: ${item.qty}. Ќе оди во минус: -${deficit}.`
				);
				// ❗ НЕ return — дозволуваме
			}
		}

		// 1) sales_receipts
		const { data: receipt, error: receiptError } = await supabase
			.from('sales_receipts')
			.insert({
				payment: paymentMethod,      // enum (CASH/CARD)
				total: totals.total,
				cash_received: cashReceived, // null ако е CARD
			})
			.select('id, receipt_no')
			.single();

		if (receiptError) throw receiptError;

		const receiptId = receipt.id as string;
		const receiptNo = receipt.receipt_no as number;

		// 2) sales_items
		const salesItemsPayload = cart.map((item) => {
			const base = num(item.product.selling_price);
			const finalRaw = priceNum(item.finalPriceStr);
			const final = clampFinalToBase(finalRaw, base);
			const discountPerUnit = discountPerUnitFromBaseFinal(base, final);

			return {
				receipt_id: receiptId,
				product_id: item.product.id,
				qty: item.qty,
				base_price: base,
				price: final,
				discount: discountPerUnit,
			};
		});

		const { error: salesItemsError } = await supabase.from('sales_items').insert(salesItemsPayload);
		if (salesItemsError) throw salesItemsError;

		// 3) stock_movements – OUT
		const { data: movement, error: movementError } = await supabase
			.from('stock_movements')
			.insert({
				type: 'OUT',
				note: note?.trim()
					? note.trim()
					: `Internal sale #${receiptNo} (${paymentMethod === 'CASH' ? 'Cash' : 'Card'})`,
			})
			.select('id')
			.single();

		if (movementError) throw movementError;

		const movementId = movement.id as string;

		// 4) stock_movement_items (ОВА е тоа што ќе ја намали “залихата” во VIEW)
		const movementItemsPayload = cart.map((item) => {
			const base = num(item.product.selling_price);
			const finalRaw = priceNum(item.finalPriceStr);
			const final = clampFinalToBase(finalRaw, base);

			return {
				movement_id: movementId,
				product_id: item.product.id,
				qty: item.qty,        // ✅ ова ќе оди OUT
				unit_cost: 0,
				unit_price: final,
			};
		});

		const { error: movementItemsError } = await supabase.from('stock_movement_items').insert(movementItemsPayload);
		if (movementItemsError) throw movementItemsError;

		// toast
		if (paymentMethod === 'CASH') {
			const change = (cashReceived ?? 0) - totals.total;
			toast.success(`Продажба зачувана ✅ (#${receiptNo}) • Готово • Кусур: ${change.toFixed(2)} ден.`);
		} else {
			toast.success(`Продажба зачувана ✅ (#${receiptNo}) • Картичка`);
		}

		onSuccess?.();
	};

	return { submitSale };
};