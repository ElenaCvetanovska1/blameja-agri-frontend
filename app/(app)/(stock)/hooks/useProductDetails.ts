import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type ProductDetails = {
	id: string;
	name: string;
	barcode: string | null;
	plu: string | null;
	selling_price: number;
	category_id: string | null;
};

export const useProductDetails = (productId: string | null, enabled: boolean) => {
	return useQuery({
		queryKey: ['product', productId],
		enabled: enabled && !!productId,
		queryFn: async () => {
			if (!productId) throw new Error('Missing productId');

			const { data, error } = await supabase
				.from('products')
				.select('id, name, barcode, plu, selling_price, category_id')
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
			} as ProductDetails;
		},
	});
};
