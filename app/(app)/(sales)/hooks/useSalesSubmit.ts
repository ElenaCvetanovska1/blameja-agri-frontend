'use client';

import { supabase } from 'app/lib/supabase-client';
import { toast } from 'sonner';
import type { CartItem, Totals } from '../types';
import { num, percentNum, priceNum } from '../utils';

export const useSalesSubmit = () => {
	const submitSale = async (args: { cart: CartItem[]; totals: Totals; note: string; onSuccess?: () => void }) => {
		const { cart, totals, note, onSuccess } = args;

		if (cart.length === 0) {
			toast.error('Кошничката е празна.');
			return;
		}

		// validate stock for each item
		for (const item of cart) {
			const { data, error } = await supabase.from('product_stock').select('qty_on_hand').eq('product_id', item.product.id).maybeSingle();

			if (error) throw error;

			const available = num((data as any)?.qty_on_hand);
			if (available < item.qty) {
				toast.error(`Нема доволно залиха за "${item.product.name}". Достапно: ${available}, бараш: ${item.qty}.`);
				return;
			}
		}

		// 1) receipt
		const { data: receipt, error: receiptError } = await supabase
			.from('sales_receipts')
			.insert({ payment: 'OTHER', total: totals.total })
			.select('id, receipt_no')
			.single();

		if (receiptError) throw receiptError;

		const receiptId = receipt.id as string;
		const receiptNo = receipt.receipt_no as number;

		// 2) sales_items
		const salesItemsPayload = cart.map((item) => {
			const price = priceNum(item.priceStr);
			const discountPerUnit = price * (percentNum(item.discountPercentStr) / 100);
			return {
				receipt_id: receiptId,
				product_id: item.product.id,
				qty: item.qty,
				price,
				discount: discountPerUnit,
			};
		});

		const { error: salesItemsError } = await supabase.from('sales_items').insert(salesItemsPayload);
		if (salesItemsError) throw salesItemsError;

		// 3) stock movement OUT
		const { data: movement, error: movementError } = await supabase
			.from('stock_movements')
			.insert({ type: 'OUT', note: note?.trim() ? note.trim() : `Internal sale #${receiptNo}` })
			.select('id')
			.single();

		if (movementError) throw movementError;

		const movementId = movement.id as string;

		const movementItemsPayload = cart.map((item) => {
			const price = priceNum(item.priceStr);
			const discountPerUnit = price * (percentNum(item.discountPercentStr) / 100);
			const finalUnit = price - discountPerUnit;

			return {
				movement_id: movementId,
				product_id: item.product.id,
				qty: item.qty,
				unit_cost: 0,
				unit_price: finalUnit,
			};
		});

		const { error: movementItemsError } = await supabase.from('stock_movement_items').insert(movementItemsPayload);

		if (movementItemsError) throw movementItemsError;

		toast.success(`Продажба зачувана ✅ (Интерно #${receiptNo})`);
		onSuccess?.();
	};

	return { submitSale };
};
