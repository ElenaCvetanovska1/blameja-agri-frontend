import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type StockRow = {
	product_id: string;
	plu: string | null;
	barcode: string | null;
	name: string | null;
	selling_price: number | null;
	category_name: string | null;
	qty_on_hand: number | null;
	last_movement_at: string | null;
};

const normalizeNumber = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

export const useStock = (search: string) => {
	return useQuery({
		queryKey: ['stock', search],
		queryFn: async () => {
			const q = search.trim();
			const path = q.length > 0 ? `/api/stock?q=${encodeURIComponent(q)}` : '/api/stock';

			const rows = await api.get<StockRow[]>(path);

			return (rows ?? []).map((r) => ({
				...r,
				selling_price: normalizeNumber(r.selling_price),
				qty_on_hand: normalizeNumber(r.qty_on_hand),
			}));
		},
	});
};
