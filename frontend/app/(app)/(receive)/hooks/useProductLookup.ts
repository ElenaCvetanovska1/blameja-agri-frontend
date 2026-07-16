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
};

const normalizeUnit = (v: unknown): Unit => {
	if (v === 'кг' || v === 'м' || v === 'пар') return v;
	return 'пар';
};

export const useProductLookup = () => {
	const mutation = useMutation({
		mutationFn: async ({ code, storeNo }: { code: string; storeNo?: number }) => {
			const trimmed = code.trim();
			if (!trimmed) throw new Error('Внеси баркод или PLU.');

			const params = new URLSearchParams({ code: trimmed });
			if (typeof storeNo === 'number') params.set('storeNo', String(storeNo));

			const data = await api.get<ProductLookup | null>(`/api/receive/products/lookup?${params}`);

			if (!data) return null;

			return {
				...data,
				unit: normalizeUnit(data.unit),
			} as ProductLookup;
		},
	});

	return {
		lookup: (code: string, storeNo?: number) => mutation.mutateAsync({ code, storeNo }),
		isLoading: mutation.isPending,
		error: mutation.isError ? (mutation.error as Error) : null,
	};
};
