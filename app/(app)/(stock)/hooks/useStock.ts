import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type StockRow = {
	product_id: string;
	plu: string | null;
	barcode: string | null;
	name: string | null;
	selling_price: number | null;
	category_name: string | null;
	qty_on_hand: number | null;
};

const normalizeNumber = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

const parsePluText = (raw: string) => {
	const t = raw.trim();
	if (!t) return null;
	if (!/^\d+$/.test(t)) return null;
	return t;
};

const escapeLike = (s: string) => s.replace(/[%_]/g, '\\$&');

export const useStock = (search: string) => {
	return useQuery({
		queryKey: ['stock', search],
		queryFn: async () => {
			const pageSize = 1000;
			let from = 0;
			let all: StockRow[] = [];

			while (true) {
				let q = supabase
					.from('product_stock')
					.select('product_id, plu, barcode, name, selling_price, qty_on_hand, category_name')
					.order('name', { ascending: true })
					.range(from, from + pageSize - 1);

				const termRaw = search.trim();
				if (termRaw.length > 0) {
					const term = escapeLike(termRaw);
					const pluText = parsePluText(termRaw);

					const orParts: string[] = [];
					orParts.push(`barcode.ilike.%${term}%`);
					orParts.push(`name.ilike.%${term}%`);
					orParts.push(`plu.ilike.%${term}%`);
					if (pluText) orParts.push(`plu.eq.${pluText}`);

					q = q.or(orParts.join(','));
				}

				const { data, error } = await q;
				if (error) throw error;

				const chunk = (data ?? []) as StockRow[];
				all = all.concat(chunk);

				if (chunk.length < pageSize) break; // последна страница
				from += pageSize;
			}

			return all.map((r) => ({
				...r,
				selling_price: normalizeNumber((r as any).selling_price),
				qty_on_hand: normalizeNumber((r as any).qty_on_hand),
			}));
		},
	});
};
