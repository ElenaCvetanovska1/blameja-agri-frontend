'use client';

import { api } from 'app/lib/api-client';
import { toast } from 'sonner';
import type { DispatchItem } from '../types';
import { num, round2 } from '../utils';

type Args = {
	docNo: string;
	docDate: string;
	rows: DispatchItem[];
	total: number;
	note?: string;
};

type DispatchResult = { id: string; receipt_no: number };

export const useDispatchSubmit = () => {
	const submitDispatch = async (args: Args) => {
		const { docNo, docDate, rows, total, note } = args;

		if (!rows.length) {
			toast.error('Нема ставки за зачувување.');
			return null;
		}

		for (const r of rows) {
			if (!r.productId) {
				throw new Error(`Недостасува productId за ставка "${r.naziv}" (PLU: ${r.sifra}). Избери производ од предлози.`);
			}
			if (num(r.kolicina) <= 0) {
				throw new Error(`Количината мора да е > 0 за "${r.naziv}".`);
			}
		}

		const data = await api.post<DispatchResult>('/api/dispatch', {
			doc_no: docNo,
			doc_date: docDate,
			total: round2(total),
			note: note?.trim() || null,
			items: rows.map((r) => ({
				product_id: r.productId,
				qty: num(r.kolicina),
				cena: num(r.cena),
				prodazna_cena: num(r.prodaznaCena),
				naziv: r.naziv,
			})),
		});

		toast.success(`Испратница зачувана ✅ (#${data.receipt_no})`);
		return { receiptId: data.id, receiptNo: data.receipt_no };
	};

	return { submitDispatch };
};
