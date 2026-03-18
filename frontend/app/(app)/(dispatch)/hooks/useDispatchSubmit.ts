'use client';

import { supabase } from 'app/lib/supabase-client';
import { toast } from 'sonner';
import type { DispatchItem } from '../types';
import { clampFinalToBase, discountPerUnitFromBaseFinal, num, round2 } from '../utils';

type Args = {
	docNo: string;
	docDate: string;
	rows: DispatchItem[]; // 🔁 тука е сменето од DispatchRowVM[] на DispatchItem[]
	total: number;
	note?: string;
};

export const useDispatchSubmit = () => {
	const submitDispatch = async (args: Args) => {
		const { docNo, docDate, rows, total, note } = args;

		if (!rows.length) {
			toast.error('Нема ставки за зачувување.');
			return null;
		}

		// safety checks
		for (const r of rows) {
			if (!r.productId) {
				throw new Error(`Недостасува productId за ставка "${r.naziv}" (PLU: ${r.sifra}). Избери производ од предлози.`);
			}
			if (num(r.kolicina) <= 0) {
				throw new Error(`Количината мора да е > 0 за "${r.naziv}".`);
			}
		}

		// 1) sales_receipts header
		const headerInsert = {
			doc_type: 'DISPATCH',
			external_doc_no: String(docNo),
			total: round2(total),

			// не е POS плаќање
			payment: null as any,
			cash_received: null as any,
		};

		const { data: receipt, error: receiptErr } = await supabase
			.from('sales_receipts')
			.insert(headerInsert)
			.select('id, receipt_no')
			.single();

		if (receiptErr) throw receiptErr;

		const receiptId = receipt.id as string;
		const receiptNo = receipt.receipt_no as number;

		// 2) sales_items (исти формули како POS)
		const itemsPayload = rows.map((r) => {
			const base = num(r.cena);
			const finalRaw = num(r.prodaznaCena);
			const final = clampFinalToBase(finalRaw, base);
			const discountPerUnit = discountPerUnitFromBaseFinal(base, final);

			return {
				receipt_id: receiptId,
				product_id: r.productId,
				qty: num(r.kolicina),
				base_price: base,
				price: final,
				discount: discountPerUnit,
			};
		});

		const { error: salesItemsErr } = await supabase.from('sales_items').insert(itemsPayload);
		if (salesItemsErr) throw salesItemsErr;

		// 3) stock_movements OUT
		const movementNote = (note?.trim() || `ИСПРАТНИЦА бр. ${docNo} (${docDate})`).slice(0, 500);

		const { data: movement, error: movementErr } = await supabase
			.from('stock_movements')
			.insert({
				type: 'OUT',
				note: movementNote,
			})
			.select('id')
			.single();

		if (movementErr) throw movementErr;

		const movementId = movement.id as string;

		const movementItemsPayload = rows.map((r) => {
			const base = num(r.cena);
			const finalRaw = num(r.prodaznaCena);
			const final = clampFinalToBase(finalRaw, base);

			return {
				movement_id: movementId,
				product_id: r.productId,
				qty: num(r.kolicina),
				unit_cost: 0,
				unit_price: final,
			};
		});

		const { error: movementItemsErr } = await supabase.from('stock_movement_items').insert(movementItemsPayload);
		if (movementItemsErr) throw movementItemsErr;

		toast.success(`Испратница зачувана ✅ (#${receiptNo})`);
		return { receiptId, receiptNo };
	};

	return { submitDispatch };
};
