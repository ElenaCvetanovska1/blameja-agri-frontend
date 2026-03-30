import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

type Payload = {
	productId: string;
	targetQty: string;
	currentQty: number;
	reason: string;
	unitCost?: number;
	unitPrice?: number;
};

const parseQty = (raw: string) => {
	const v = raw.trim().replace(',', '.');
	const num = Number.parseFloat(v);
	return Number.isFinite(num) ? num : Number.NaN;
};

export const useAdjustStockMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: Payload) => {
			if (!payload.productId) throw new Error('Нема избран производ.');

			const target = parseQty(payload.targetQty);
			if (!Number.isFinite(target) || target < 0) throw new Error('Нова залиха мора да биде број >= 0.');

			const current = Number(payload.currentQty ?? 0);
			const delta = target - current;

			if (Math.abs(delta) < 0.0000001) throw new Error('Нема промена (новата залиха е иста).');

			const reason = payload.reason.trim();
			if (!reason) throw new Error('Внеси причина (кратко).');

			// userId is resolved server-side from JWT — no longer sent from client
			await api.post('/api/stock/adjust', {
				product_id: payload.productId,
				target_qty: target,
				current_qty: current,
				reason,
				unit_cost: payload.unitCost ?? 0,
				unit_price: payload.unitPrice ?? 0,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['stock'], exact: false });
		},
	});
};
