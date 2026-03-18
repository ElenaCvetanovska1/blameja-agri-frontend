import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type CategoryRow = {
	id: string;
	name: string;
	code: string | null;
};

export const useCategories = () => {
	return useQuery({
		queryKey: ['categories'],
		queryFn: () => api.get<CategoryRow[]>('/api/categories'),
	});
};
