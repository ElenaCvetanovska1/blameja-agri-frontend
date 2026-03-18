'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';
import type { BuyerRow } from '../types';

export const useBuyerAll = (enabled: boolean) => {
	return useQuery({
		queryKey: ['buyers', 'all'],
		enabled,
		queryFn: () => api.get<BuyerRow[]>('/api/buyers'),
		staleTime: 5 * 60_000,
	});
};
