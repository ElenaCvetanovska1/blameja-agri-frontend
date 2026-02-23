import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type Unit = 'пар' | 'кг' | 'м';

export type ProductDetails = {
	id: string;
	name: string;
	barcode: string | null;
	plu: string | null;
	selling_price: number;
	category_id: string | null;

	// ✅ NEW
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

			const { data, error } = await supabase
				.from('products')
				.select('id, name, barcode, plu, selling_price, category_id, unit')
				.eq('id', productId)
				.single();

			if (error) throw error;

			return {
				id: data.id,
				name: data.name,
				barcode: data.barcode,
				plu: data.plu,
				selling_price: Number(data.selling_price ?? 0),
				category_id: data.category_id,
				unit: normalizeUnit((data as any).unit),
			} as ProductDetails;
		},
	});
};