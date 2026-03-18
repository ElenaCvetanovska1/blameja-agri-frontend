// receive/hooks/useProductChoices.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';
import { escapeLike } from '../utils';

type Args = {
	name: string;
	categoryId: string;
	limit?: number;
	storeNo?: number; // 20 or 30
};

export type Row = {
	id: string;
	name: string | null;
	plu: string | null;
	barcode: string | null;
	selling_price: number | null;
	tax_group: number | null;
	category_id: string | null;
	unit: string | null;
	store_no: number | null;
	categories?: { name: string | null }[] | null;};

export const useProductChoices = ({ name, categoryId, limit = 10, storeNo }: Args) => {
	return useQuery({
		queryKey: ['product-choices', name, categoryId, limit, storeNo],
		queryFn: async () => {
			const t0 = name.trim();
			if (!t0) return [];

			const t = escapeLike(t0);

			let q = supabase
				.from('products')
				// ✅ no "as" here
				.select('id, name, plu, barcode, selling_price, tax_group, category_id, unit, store_no, categories(name)')
				.eq('is_active', true)
				.ilike('name', `%${t}%`)
				.order('name', { ascending: true })
				.limit(limit);

			if (categoryId?.trim()) q = q.eq('category_id', categoryId);
			if (typeof storeNo === 'number') q = q.eq('store_no', storeNo);

			const { data, error } = await q;
			if (error) throw error;

			return (data ?? []) as Row[];
		},
		enabled: name.trim().length > 0,
	});
};