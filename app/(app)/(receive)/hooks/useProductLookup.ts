import { useMutation } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type ProductLookup = {
	id: string;
	plu: number | null;
	barcode: string | null;
	name: string;
	description: string | null;
	unit: string;
	selling_price: number;
	tax_group: number | null; // 5/10/18 (ако го имаш)
	category_id: string | null;
	subcategory_id: string | null;
};

const parsePlu = (raw: string) => {
	const t = raw.trim();
	if (!t) return null;
	if (!/^\d+$/.test(t)) return null;
	const n = Number.parseInt(t, 10);
	return Number.isFinite(n) ? n : null;
};

export const useProductLookup = () => {
	const mutation = useMutation({
		mutationFn: async (code: string) => {
			const trimmed = code.trim();
			if (!trimmed) throw new Error('Внеси баркод или PLU.');

			const pluNum = parsePlu(trimmed);

			// ако е број -> пробај и plu и barcode
			const orParts: string[] = [];
			orParts.push(`barcode.eq.${trimmed}`);
			if (pluNum !== null) orParts.push(`plu.eq.${pluNum}`);

			const { data, error } = await supabase
				.from('products')
				.select('id, plu, barcode, name, description, unit, selling_price, tax_group, category_id, subcategory_id')
				.or(orParts.join(','))
				.maybeSingle();

			if (error) throw error;
			return (data ?? null) as ProductLookup | null;
		},
	});

	return {
		lookup: (code: string) => mutation.mutateAsync(code),
		isLoading: mutation.isPending,
		error: mutation.isError ? (mutation.error as Error) : null,
	};
};
