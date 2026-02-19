'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';
import type { CategoryRow } from '../types';

export const useCategoryOptions = () => {
	return useQuery({
		queryKey: ['receive', 'categories'],
		queryFn: async () => {
			const { data, error } = await supabase.from('categories').select('id, name, code').order('name', { ascending: true });

			if (error) throw error;
			return (data ?? []) as CategoryRow[];
		},
		staleTime: 60_000,
	});
};
