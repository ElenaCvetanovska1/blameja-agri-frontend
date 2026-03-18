import { useMutation } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type Unit = 'пар' | 'кг' | 'м';

export type ProductLookup = {
	id: string;
	plu: string | null; // ✅ TEXT
	barcode: string | null;
	name: string;
	description: string | null;

	unit: Unit; // ✅ strict
	selling_price: number;
	tax_group: number | null;
	category_id: string | null;
	subcategory_id: string | null;
};

const parsePluText = (raw: string) => {
	const t = raw.trim();
	if (!t) return null;
	if (!/^\d+$/.test(t)) return null;
	return t; // ✅ keep as text
};

const normalizeUnit = (v: unknown): Unit => {
	if (v === 'кг' || v === 'м' || v === 'пар') return v;
	return 'пар';
};

export const useProductLookup = () => {
	const mutation = useMutation({
		mutationFn: async (code: string) => {
			const trimmed = code.trim();
			if (!trimmed) throw new Error('Внеси баркод или PLU.');

			const pluText = parsePluText(trimmed);

			const orParts: string[] = [];
			orParts.push(`barcode.eq.${trimmed}`);
			if (pluText !== null) orParts.push(`plu.eq.${pluText}`); // ✅ string compare

			const { data, error } = await supabase
				.from('products')
				.select('id, plu, barcode, name, description, unit, selling_price, tax_group, category_id, subcategory_id')
				.or(orParts.join(','))
				.maybeSingle();

			if (error) throw error;

			if (!data) return null;

			return {
				...(data as Omit<ProductLookup, 'unit'>),
				unit: normalizeUnit((data as any).unit),
			} as ProductLookup;
		},
	});

	return {
		lookup: (code: string) => mutation.mutateAsync(code),
		isLoading: mutation.isPending,
		error: mutation.isError ? (mutation.error as Error) : null,
	};
};
