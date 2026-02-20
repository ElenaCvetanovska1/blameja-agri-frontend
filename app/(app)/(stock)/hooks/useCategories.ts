import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type CategoryRow = {
	id: string;
	name: string;
	code: string | null;
};

export const useCategories = () => {
	return useQuery({
		queryKey: ['categories'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('categories')
				.select('id, name, code')
				.order('name', { ascending: true });

			if (error) throw error;
			return (data ?? []) as CategoryRow[];
		},
	});
};