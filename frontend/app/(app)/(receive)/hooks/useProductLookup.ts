import { useMutation } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type Unit = 'пар' | 'кг' | 'м';

export type ProductLookup = {
	id: string;
	plu: string | null;
	barcode: string | null;
	name: string;
	description: string | null;
	unit: Unit;
	selling_price: number;
	tax_group: number | null;
	category_id: string | null;
	subcategory_id: string | null;
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

			const data = await api.get<ProductLookup | null>(`/api/receive/products/lookup?code=${encodeURIComponent(trimmed)}`);

			if (!data) return null;

			return {
				...data,
				unit: normalizeUnit(data.unit),
			} as ProductLookup;
		},
	});

	return {
		lookup: (code: string) => mutation.mutateAsync(code),
		isLoading: mutation.isPending,
		error: mutation.isError ? (mutation.error as Error) : null,
	};
};
