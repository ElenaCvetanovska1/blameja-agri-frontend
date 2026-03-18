import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

type Category    = { id: string; code: string; name: string };
type Subcategory = { id: string; category_id: string; code: string; name: string };

export type CategoryNode = Category & { subcategories: Subcategory[] };

export const useCategoryTree = () => {
	return useQuery({
		queryKey: ['categoryTree'],
		queryFn: () => api.get<CategoryNode[]>('/api/categories/tree'),
	});
};
