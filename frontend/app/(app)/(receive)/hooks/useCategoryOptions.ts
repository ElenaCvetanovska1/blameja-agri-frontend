'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';
import type { CategoryRow } from '../types';

export const useCategoryOptions = () => {
	return useQuery({
		queryKey: ['receive', 'categories'],
		queryFn: () => api.get<CategoryRow[]>('/api/categories'),
		staleTime: 60_000,
	});
};
