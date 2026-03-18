import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type Unit = 'пар' | 'кг' | 'м';

export type ProductDetails = {
	id: string;
	name: string;
	barcode: string | null;
	plu: string | null;
	selling_price: number;
	category_id: string | null;
	unit: Unit;
};

const normalizeUnit = (v: unknown): Unit => {
	if (v === 'кг' || v === 'м' || v === 'пар') return v;
	return 'пар';
};

export const useProductDetails = (productId: string | null, enabled: boolean) => {
	return useQuery({
		queryKey: ['product', productId],
		enabled: enabled && !!productId,
		queryFn: async () => {
			if (!productId) throw new Error('Missing productId');

			const data = await api.get<{
				id: string;
				name: string;
				barcode: string | null;
				plu: string | null;
				selling_price: number;
				category_id: string | null;
				unit: unknown;
			}>(`/api/stock/${productId}`);

			return {
				id:            data.id,
				name:          data.name,
				barcode:       data.barcode,
				plu:           data.plu,
				selling_price: Number(data.selling_price ?? 0),
				category_id:   data.category_id,
				unit:          normalizeUnit(data.unit),
			} as ProductDetails;
		},
	});
};
