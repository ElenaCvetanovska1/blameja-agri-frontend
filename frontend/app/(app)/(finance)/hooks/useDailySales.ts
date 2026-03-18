import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type DailySalesRow = {
	day: string;
	receipts_count: number;
	total: number;
};

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

export const useDailySales = (fromISO: string, toISO: string) => {
	return useQuery({
		queryKey: ['finance-daily-sales', fromISO, toISO],
		queryFn: async () => {
			const rows = await api.get<DailySalesRow[]>(
				`/api/finance/daily-sales?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
			);

			return (rows ?? []).map((r): DailySalesRow => ({
				day:            r.day,
				receipts_count: Math.trunc(num(r.receipts_count)),
				total:          num(r.total),
			}));
		},
	});
};
