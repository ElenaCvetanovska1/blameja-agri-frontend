'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from 'app/lib/api-client';
import { type FiscalArticle, fiscalArticles, fiscalErrorMessage, taxPercentToVatGroup } from 'app/lib/fiscal-bridge';
import { FISCAL_ARTICLES_KEY } from './useFiscalArticles';

export { taxPercentToVatGroup };

// ─── Types ────────────────────────────────────────────────────────────────────

/** Ред од /api/stock (базата). tax_group е ДДВ ПРОЦЕНТ: 18 / 5 / 10 / null (=0%). */
export type DbStockRow = {
	product_id: string;
	plu: string | null;
	name: string | null;
	selling_price: number | null;
	qty_on_hand: number | null;
	category_name: string | null;
	tax_group: number | null;
	/** МКД производ — фискален атрибут, се праќа по ставка при продажба. */
	is_macedonian: boolean | null;
};

export type SyncStatus = 'match' | 'diff' | 'db_only' | 'fiscal_only';

export type ComparisonRow = {
	plu: number;
	db?: DbStockRow;
	fiscal?: FiscalArticle;
	status: SyncStatus;
	/** Кои полиња се разликуваат (за status='diff'): 'име' | 'цена' | 'ддв' */
	diffs: string[];
	/** Вредности што „Синхронизирај“ ќе ги запише во касата (од базата). */
	target?: { name: string; price: number; vatGroup: 'A' | 'B' | 'V' | 'G' };
};

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/** Максимална должина на име во касата (како Java printer truncation ~20). */
export const FISCAL_NAME_MAX = 20;

const PRICE_TOLERANCE = 0.01;

function fiscalNameFromDb(dbName: string): string {
	return dbName.trim().toUpperCase().slice(0, FISCAL_NAME_MAX);
}

function compare(db: DbStockRow[], fiscal: FiscalArticle[]): ComparisonRow[] {
	const fiscalByPlu = new Map<number, FiscalArticle>();
	for (const f of fiscal) fiscalByPlu.set(f.plu, f);

	const dbByPlu = new Map<number, DbStockRow>();
	for (const p of db) {
		if (!p.plu) continue;
		const n = Number.parseInt(p.plu, 10);
		if (Number.isInteger(n) && n > 0) dbByPlu.set(n, p);
	}

	const rows: ComparisonRow[] = [];
	const seen = new Set<number>();

	for (const [plu, f] of fiscalByPlu) {
		seen.add(plu);
		const d = dbByPlu.get(plu);
		if (!d) {
			rows.push({ plu, fiscal: f, status: 'fiscal_only', diffs: [] });
			continue;
		}

		const target = {
			name: fiscalNameFromDb(d.name ?? ''),
			price: d.selling_price ?? 0,
			vatGroup: taxPercentToVatGroup(d.tax_group),
		};

		const diffs: string[] = [];
		if (f.name.trim().toUpperCase() !== target.name) diffs.push('име');
		if (Math.abs(f.price - target.price) > PRICE_TOLERANCE) diffs.push('цена');
		if (f.vatGroup !== target.vatGroup) diffs.push('ддв');

		rows.push({ plu, db: d, fiscal: f, status: diffs.length === 0 ? 'match' : 'diff', diffs, target });
	}

	for (const [plu, d] of dbByPlu) {
		if (seen.has(plu)) continue;
		rows.push({
			plu,
			db: d,
			status: 'db_only',
			diffs: [],
			target: {
				name: fiscalNameFromDb(d.name ?? ''),
				price: d.selling_price ?? 0,
				vatGroup: taxPercentToVatGroup(d.tax_group),
			},
		});
	}

	return rows.sort((a, b) => a.plu - b.plu);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useArticleComparison = () => {
	const queryClient = useQueryClient();

	const fiscalQuery = useQuery({
		queryKey: FISCAL_ARTICLES_KEY,
		queryFn: fiscalArticles.getAll,
		retry: false,
		refetchOnWindowFocus: false,
		staleTime: 60_000,
	});

	const dbQuery = useQuery({
		queryKey: ['stock', ''],
		queryFn: () => api.get<DbStockRow[]>('/api/stock'),
		staleTime: 60_000,
	});

	const rows = useMemo(() => {
		if (!fiscalQuery.data || !dbQuery.data) return [];
		return compare(dbQuery.data, fiscalQuery.data);
	}, [fiscalQuery.data, dbQuery.data]);

	const stats = useMemo(
		() => ({
			total: rows.length,
			matches: rows.filter((r) => r.status === 'match').length,
			diffs: rows.filter((r) => r.status === 'diff').length,
			dbOnly: rows.filter((r) => r.status === 'db_only').length,
			fiscalOnly: rows.filter((r) => r.status === 'fiscal_only').length,
		}),
		[rows],
	);

	/** Запиши ги вредностите од базата во касата (program на тој PLU). */
	const syncToFiscal = useMutation({
		mutationFn: (row: ComparisonRow) => {
			if (!row.target) throw new Error('Нема податоци од базата за овој PLU.');
			return fiscalArticles.program({ plu: row.plu, ...row.target });
		},
		onSuccess: (_res, row) => {
			toast.success(`PLU ${row.plu} синхронизиран во касата.`);
			void queryClient.invalidateQueries({ queryKey: FISCAL_ARTICLES_KEY });
		},
		onError: (err, row) => toast.error(`Синхронизација на PLU ${row.plu} неуспешна: ${fiscalErrorMessage(err)}`),
	});

	/** Избриши артикал што постои само во касата. */
	const removeFromFiscal = useMutation({
		mutationFn: (plu: number) => fiscalArticles.remove(plu),
		onSuccess: (_res, plu) => {
			toast.success(`PLU ${plu} избришан од касата.`);
			void queryClient.invalidateQueries({ queryKey: FISCAL_ARTICLES_KEY });
		},
		onError: (err, plu) => toast.error(`Бришење на PLU ${plu} неуспешно: ${fiscalErrorMessage(err)}`),
	});

	const refetch = () => Promise.allSettled([fiscalQuery.refetch(), dbQuery.refetch()]);

	return {
		rows,
		stats,
		isLoading: fiscalQuery.isPending || dbQuery.isPending,
		fiscalQuery,
		dbQuery,
		syncToFiscal,
		removeFromFiscal,
		refetch,
	};
};
