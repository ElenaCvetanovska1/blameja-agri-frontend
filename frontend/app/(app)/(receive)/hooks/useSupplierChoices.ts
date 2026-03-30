import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';
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

const fetchSuppliers = (q: string, limit: number) =>
	api.get<SupplierRow[]>(`/api/suppliers/search?q=${encodeURIComponent(q)}&limit=${limit}`);

export const useSupplierChoices = ({ q, limit = 12, openAll = false }: Args) => {
	const debounced = useDebouncedValue(q, 220);
	const term = debounced.trim();

	const browseQuery = useQuery({
		queryKey: ['suppliers', 'browse', limit],
		queryFn: () => fetchSuppliers('', limit),
		enabled: openAll,
		staleTime: 60_000,
	});

	const searchQuery = useQuery({
		queryKey: ['suppliers', 'search', term, limit],
		queryFn: () => fetchSuppliers(term, limit),
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
