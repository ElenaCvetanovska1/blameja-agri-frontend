import { useMutation } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type ProductLookup = {
	id: string;
	sku: string | null;
	barcode: string | null;
	name: string;
	description: string | null;
	unit: string;
	selling_price: number;
	category_id: string | null;
	subcategory_id: string | null;
};

export const useProductLookup = () => {
	const mutation = useMutation({
		mutationFn: async (code: string) => {
			const trimmed = code.trim();
			if (!trimmed) throw new Error('Внеси баркод или SKU.');

			const { data, error } = await supabase
				.from('products')
				.select('id, sku, barcode, name, description, unit, selling_price, category_id, subcategory_id')
				.or(`barcode.eq.${trimmed},sku.eq.${trimmed}`)
				.maybeSingle();

			if (error) throw error;
			return (data ?? null) as ProductLookup | null;
		},
	});

	const lookup = (code: string) => mutation.mutateAsync(code);

	return {
		lookup,
		isLoading: mutation.isPending,
		error: mutation.isError ? (mutation.error as Error) : null,
	};
};
