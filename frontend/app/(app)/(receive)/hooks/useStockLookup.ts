import { useMutation } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type StockLookupRow = {
	product_id: string;
	plu: string | null;
	barcode: string | null;
	name: string | null;
	selling_price: number | null;
	category_name: string | null;
	qty_on_hand: number | null;
};

export const useStockLookup = () => {
	const mutation = useMutation({
		mutationFn: async (code: string) => {
			const trimmed = code.trim();
			if (!trimmed) throw new Error('Внеси PLU или баркод.');

			const result = await api.get<StockLookupRow | null>(`/api/receive/stock/lookup?code=${encodeURIComponent(trimmed)}`);

			return result ?? null;
		},
	});

	return {
		lookupStock: (code: string) => mutation.mutateAsync(code),
		isLoading: mutation.isPending,
		error: mutation.isError ? (mutation.error as Error) : null,
	};
};
