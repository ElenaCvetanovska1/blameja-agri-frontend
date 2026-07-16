'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type ProgramArticleInput, fiscalArticles, fiscalErrorMessage } from 'app/lib/fiscal-bridge';

export const FISCAL_ARTICLES_KEY = ['fiscal', 'articles'] as const;

/**
 * Артикли во фискалната меморија (реален FiscalBridge контракт).
 * - listata се вчитува на отворање на табот + рачно освежување (без focus-refetch —
 *   читањето оди артикал по артикал преку сериска врска и може да потрае).
 * - program/remove по успех ја инвалидираат листата и известуваат со toast.
 */
export const useFiscalArticles = () => {
	const queryClient = useQueryClient();

	const list = useQuery({
		queryKey: FISCAL_ARTICLES_KEY,
		queryFn: fiscalArticles.getAll,
		retry: false,
		refetchOnWindowFocus: false,
		staleTime: 60_000,
	});

	const program = useMutation({
		mutationFn: (input: ProgramArticleInput) => fiscalArticles.program(input),
		onSuccess: (_res, input) => {
			toast.success(`Артикал PLU ${input.plu} „${input.name}“ програмиран во касата.`);
			void queryClient.invalidateQueries({ queryKey: FISCAL_ARTICLES_KEY });
		},
		onError: (err, input) => toast.error(`Програмирање на PLU ${input.plu} неуспешно: ${fiscalErrorMessage(err)}`),
	});

	const remove = useMutation({
		mutationFn: (plu: number) => fiscalArticles.remove(plu),
		onSuccess: (_res, plu) => {
			toast.success(`Артикал PLU ${plu} избришан од касата.`);
			void queryClient.invalidateQueries({ queryKey: FISCAL_ARTICLES_KEY });
		},
		onError: (err, plu) => toast.error(`Бришење на PLU ${plu} неуспешно: ${fiscalErrorMessage(err)}`),
	});

	const readOne = useMutation({
		mutationFn: (plu: number) => fiscalArticles.read(plu),
		onError: (err, plu) => toast.error(`Читање на PLU ${plu} неуспешно: ${fiscalErrorMessage(err)}`),
	});

	return { list, program, remove, readOne };
};
