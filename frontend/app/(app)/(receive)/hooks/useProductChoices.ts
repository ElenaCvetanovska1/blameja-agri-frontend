'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

type Args = {
	name: string;
	categoryId: string;
	limit?: number;
	storeNo?: number;
};

export type Row = {
	id: string;
	name: string | null;
	plu: string | null;
	barcode: string | null;
	selling_price: number | null;
	tax_group: number | null;
	category_id: string | null;
	category_name?: string | null;
	unit: string | null;
	store_no: number | null;
};

export const useProductChoices = ({ name, categoryId, limit = 10, storeNo }: Args) => {
	return useQuery({
		queryKey: ['product-choices', name, categoryId, limit, storeNo],
		queryFn: async () => {
			const t0 = name.trim();
			if (!t0) return [];

			const params = new URLSearchParams({ q: t0, limit: String(limit) });
			if (categoryId?.trim()) params.set('categoryId', categoryId.trim());
			if (typeof storeNo === 'number') params.set('storeNo', String(storeNo));

			return api.get<Row[]>(`/api/receive/products/search?${params}`);
		},
		enabled: name.trim().length > 0,
	});
};
