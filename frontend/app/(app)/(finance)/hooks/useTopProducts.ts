import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type TopProductRow = {
	product_id: string;
	plu: string | null;
	name: string;
	qty: number;
	revenue: number;
};

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

export const useTopProducts = (fromISO: string, toISO: string, limit = 8) => {
	return useQuery({
		queryKey: ['finance-top-products', fromISO, toISO, limit],
		queryFn: async () => {
			const rows = await api.get<TopProductRow[]>(
				`/api/finance/top-products?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&limit=${limit}`,
			);

			return (rows ?? []).map(
				(r): TopProductRow => ({
					product_id: r.product_id,
					plu: r.plu ?? null,
					name: r.name,
					qty: num(r.qty),
					revenue: num(r.revenue),
				}),
			);
		},
	});
};
