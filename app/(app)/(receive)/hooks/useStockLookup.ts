import { useMutation } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type StockLookupRow = {
	product_id: string;
	sku: string | null;
	barcode: string | null;
	name: string;
	unit: string;
	selling_price: number;
	category_name: string | null;
	subcategory_name: string | null;
	qty_on_hand: number;
	last_movement_at: string | null;
};

export const useStockLookup = () => {
	const mutation = useMutation({
		mutationFn: async (code: string) => {
			const trimmed = code.trim();
			if (!trimmed) throw new Error('Внеси SKU или баркод.');

			const { data, error } = await supabase
				.from('product_stock')
				.select('product_id, sku, barcode, name, unit, selling_price, category_name, subcategory_name, qty_on_hand, last_movement_at')
				.or(`sku.eq.${trimmed},barcode.eq.${trimmed}`)
				.maybeSingle();

			if (error) throw error;
			return (data ?? null) as StockLookupRow | null;
		},
	});

	return {
		lookupStock: (code: string) => mutation.mutateAsync(code),
		isLoading: mutation.isPending,
		error: mutation.isError ? (mutation.error as Error) : null,
	};
};
