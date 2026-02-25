import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

type Payload = {
	productId: string;
	clearCodes?: boolean;
};

export const useDeactivateProductMutation = () => {
	const qc = useQueryClient();

	return useMutation({
		mutationFn: async ({ productId, clearCodes = true }: Payload) => {
			if (!productId) throw new Error('Нема избран производ.');

			// Soft delete: is_active=false
			// + optional: clear barcode/plu за да нема конфликт и да не се "фаќа" при пребарување
			const updatePayload: Record<string, unknown> = {
				is_active: false,
				updated_at: new Date().toISOString(),
			};

			if (clearCodes) {
				updatePayload.barcode = null;
				updatePayload.plu = null;
			}

			const { error } = await supabase.from('products').update(updatePayload).eq('id', productId);

			if (error) throw error;
		},
		onSuccess: async () => {
			await qc.invalidateQueries({ queryKey: ['stock'], exact: false });
			await qc.invalidateQueries({ queryKey: ['products'], exact: false });
			await qc.invalidateQueries({ queryKey: ['product_stock'], exact: false });
			await qc.invalidateQueries({ queryKey: ['product-choices'], exact: false });
		},
	});
};
