// hooks/useBuyerAll.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';
import type { BuyerRow } from '../types';

const PAGE_SIZE = 1000;

const fetchAllBuyersPaged = async (): Promise<BuyerRow[]> => {
	const all: BuyerRow[] = [];
	let from = 0;

	for (;;) {
		const to = from + PAGE_SIZE - 1;

		// ✅ RPC + range paging (го заобиколува max rows 1000)
		const { data, error } = await supabase.rpc('buyers_all').range(from, to);

		if (error) throw error;

		const chunk = (data ?? []) as BuyerRow[];
		all.push(...chunk);

		// ако врати помалку од PAGE_SIZE -> нема повеќе
		if (chunk.length < PAGE_SIZE) break;

		from += PAGE_SIZE;
	}

	return all;
};

export const useBuyerAll = (enabled: boolean) => {
	return useQuery({
		queryKey: ['buyers', 'all'],
		enabled,
		queryFn: fetchAllBuyersPaged,
		staleTime: 5 * 60_000,
	});
};