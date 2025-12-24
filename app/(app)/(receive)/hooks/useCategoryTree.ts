import { useQuery } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

type Category = { id: string; code: string; name: string };
type Subcategory = { id: string; category_id: string; code: string; name: string };

export type CategoryNode = Category & { subcategories: Subcategory[] };

export const useCategoryTree = () => {
	return useQuery({
		queryKey: ['categoryTree'],
		queryFn: async () => {
			const [{ data: cats, error: catsErr }, { data: subs, error: subsErr }] = await Promise.all([
				supabase.from('categories').select('id, code, name').order('name', { ascending: true }),
				supabase.from('subcategories').select('id, category_id, code, name').order('name', { ascending: true }),
			]);

			if (catsErr) throw catsErr;
			if (subsErr) throw subsErr;

			const byCat = new Map<string, Subcategory[]>();
			(subs ?? []).forEach((s) => {
				const arr = byCat.get(s.category_id) ?? [];
				arr.push(s);
				byCat.set(s.category_id, arr);
			});

			return (cats ?? []).map((c) => ({
				...c,
				subcategories: byCat.get(c.id) ?? [],
			})) as CategoryNode[];
		},
	});
};
