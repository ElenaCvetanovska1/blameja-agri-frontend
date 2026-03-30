import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type Unit = 'пар' | 'кг' | 'м';

export type UpdateProductPayload = {
	productId: string;
	name: string;
	barcode: string | null;
	plu: string | null;
	selling_price: number;
	category_id: string | null;
	unit: Unit;
};

const cleanText = (v: string) => v.trim();

const cleanOptional = (v: string) => {
	const t = v.trim();
	return t.length ? t : null;
};

const cleanPlu = (v: string) => {
	const t = v.trim();
	if (!t) return null;
	if (!/^\d+$/.test(t)) throw new Error('PLU мора да биде само бројки.');
	return t;
};

const normalizeUnit = (v: unknown): Unit => {
	if (v === 'кг' || v === 'м' || v === 'пар') return v;
	return 'пар';
};

export const useUpdateProductMutation = () => {
	const qc = useQueryClient();

	return useMutation({
		mutationFn: async (payload: UpdateProductPayload) => {
			if (!payload.productId) throw new Error('Нема избран производ.');

			const name = cleanText(payload.name);
			if (!name) throw new Error('Ime е задолжително.');

			const price = Number(payload.selling_price);
			if (!Number.isFinite(price) || price < 0) throw new Error('Продажна цена мора да е број >= 0.');

			const plu = cleanPlu(payload.plu ?? '');
			const barcode = cleanOptional(payload.barcode ?? '');
			const unit = normalizeUnit(payload.unit);

			await api.put(`/api/products/${payload.productId}`, {
				name,
				plu,
				barcode,
				selling_price: price,
				category_id: payload.category_id ?? null,
				unit,
			});
		},
		onSuccess: async (_data, vars) => {
			await qc.invalidateQueries({ queryKey: ['stock'], exact: false });
			await qc.invalidateQueries({ queryKey: ['product', vars.productId] });
		},
	});
};
