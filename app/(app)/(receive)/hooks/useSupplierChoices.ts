import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';
import { useDebouncedValue } from './useDebouncedValue';

export type SupplierRow = {
	id: string;
	name: string;
	address: string | null;
};

type Args = {
	q: string;
	limit?: number;
	openAll?: boolean;
};

const rpcSuppliers = async (q: string, limit: number) => {
	const { data, error } = await supabase.rpc('suppliers_search', {
		_q: q, // ✅ MUST be _q (not q)
		_limit: limit, // ✅ MUST be _limit
	});

	if (error) throw error;
	return (data ?? []) as SupplierRow[];
};

export const useSupplierChoices = ({ q, limit = 12, openAll = false }: Args) => {
	const debounced = useDebouncedValue(q, 220);
	const term = debounced.trim();

	// ✅ browse: _q = ""
	const browseQuery = useQuery({
		queryKey: ['suppliers', 'browse', limit],
		queryFn: () => rpcSuppliers('', limit),
		enabled: openAll,
		staleTime: 60_000,
	});

	// ✅ search: _q = term
	const searchQuery = useQuery({
		queryKey: ['suppliers', 'search', term, limit],
		queryFn: () => rpcSuppliers(term, limit),
		enabled: !openAll && term.length >= 1,
		staleTime: 60_000,
	});

	const active = openAll ? browseQuery : searchQuery;

	return {
		...active,
		data: active.data ?? [],
		isFetching: browseQuery.isFetching || searchQuery.isFetching,
	};
};
