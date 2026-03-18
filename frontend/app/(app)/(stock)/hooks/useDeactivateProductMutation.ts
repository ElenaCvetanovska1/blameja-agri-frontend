import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

type Payload = {
	productId: string;
	clearCodes?: boolean;
};

export const useDeactivateProductMutation = () => {
	const qc = useQueryClient();

	return useMutation({
		mutationFn: async ({ productId, clearCodes = true }: Payload) => {
			if (!productId) throw new Error('Нема избран производ.');

			await api.post(`/api/products/${productId}/deactivate`, { clear_codes: clearCodes });
		},
		onSuccess: async () => {
			await qc.invalidateQueries({ queryKey: ['stock'], exact: false });
			await qc.invalidateQueries({ queryKey: ['products'], exact: false });
			await qc.invalidateQueries({ queryKey: ['product_stock'], exact: false });
			await qc.invalidateQueries({ queryKey: ['product-choices'], exact: false });
		},
	});
};
