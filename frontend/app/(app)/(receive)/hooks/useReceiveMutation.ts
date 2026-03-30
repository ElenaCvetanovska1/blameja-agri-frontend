import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type Unit = 'пар' | 'кг' | 'м';
export type StoreNo = 20 | 30;

export type ReceivePayload = {
	plu: string;
	name: string;
	categoryId: string;
	qty: string;
	barcode: string;
	sellingPrice: string;
	unitCost: string;
	description: string;
	note: string;
	taxGroup: '5' | '10' | '18';
	supplierId?: string | null;
	unit: Unit | null;
	storeNo: StoreNo;
};

export const useReceiveMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: ReceivePayload) => {
			// userId is resolved server-side from JWT — no getUser() call needed
			const result = await api.post<{ product_id: string; movement_id: string }>('/api/receive', {
				plu: payload.plu,
				name: payload.name,
				category_id: payload.categoryId,
				qty: payload.qty,
				barcode: payload.barcode,
				selling_price: payload.sellingPrice,
				unit_cost: payload.unitCost,
				description: payload.description,
				note: payload.note,
				tax_group: payload.taxGroup,
				supplier_id: payload.supplierId ?? null,
				unit: payload.unit,
				store_no: payload.storeNo,
			});

			return {
				productId: result.product_id,
				movementId: result.movement_id,
			};
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['products'] });
			await queryClient.invalidateQueries({ queryKey: ['stock'] });
			await queryClient.invalidateQueries({ queryKey: ['product_stock'] });
			await queryClient.invalidateQueries({ queryKey: ['categories'] });
			await queryClient.invalidateQueries({ queryKey: ['product-choices'] });
		},
	});
};
