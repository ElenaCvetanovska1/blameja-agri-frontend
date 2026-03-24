'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';
import { fiscalBridge, type ItemDetail } from 'app/lib/fiscal-bridge';
import { truncateFiscalName } from 'app/lib/fiscal-bridge';

// ─── DB product shape (from /api/stock) ──────────────────────────────────────

type StockRow = {
	product_id: string;
	plu: string | null;
	name: string | null;
	selling_price: number | null;
	category_name: string | null;
	qty_on_hand: number | null;
};

// ─── Comparison types ─────────────────────────────────────────────────────────

export type CompareStatus =
	| 'match'           // PLU, name (first 32 chars) and price all match
	| 'name_mismatch'   // PLU matches but name differs
	| 'price_mismatch'  // PLU matches but price differs
	| 'both_mismatch'   // PLU matches but name and price both differ
	| 'fiscal_only'     // in fiscal device but no DB product has this PLU
	| 'db_only';        // DB product has PLU but no fiscal item at that PLU

export type ComparedItem = {
	plu: number;
	fiscalItem?: ItemDetail;
	dbProduct?: StockRow;
	status: CompareStatus;
};

const PRICE_TOLERANCE = 0.01;

function compareItems(fiscal: ItemDetail[], db: StockRow[]): ComparedItem[] {
	const fiscalByPlu = new Map<number, ItemDetail>();
	for (const fi of fiscal) fiscalByPlu.set(fi.Plu, fi);

	const dbByPlu = new Map<number, StockRow>();
	for (const p of db) {
		if (!p.plu) continue;
		const n = Number(p.plu);
		if (!Number.isNaN(n) && n > 0) dbByPlu.set(n, p);
	}

	const results: ComparedItem[] = [];
	const seen = new Set<number>();

	for (const [plu, fi] of fiscalByPlu) {
		seen.add(plu);
		const db = dbByPlu.get(plu);
		if (!db) {
			results.push({ plu, fiscalItem: fi, status: 'fiscal_only' });
			continue;
		}
		const fiscalPrice = parseFloat(fi.Price);
		const dbName32 = truncateFiscalName(db.name ?? '', 32);
		const nameOk = fi.Name.toLowerCase() === dbName32.toLowerCase();
		const priceOk = Math.abs(fiscalPrice - (db.selling_price ?? 0)) < PRICE_TOLERANCE;
		const status: CompareStatus =
			nameOk && priceOk ? 'match'
			: !nameOk && !priceOk ? 'both_mismatch'
			: !nameOk ? 'name_mismatch'
			: 'price_mismatch';
		results.push({ plu, fiscalItem: fi, dbProduct: db, status });
	}

	for (const [plu, dbp] of dbByPlu) {
		if (!seen.has(plu)) results.push({ plu, dbProduct: dbp, status: 'db_only' });
	}

	return results.sort((a, b) => a.plu - b.plu);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useFiscalItemsQuery = () => {
	const fiscalQuery = useQuery({
		queryKey: ['fiscal-items'],
		queryFn: () => fiscalBridge.getAllItems(),
		retry: false,
	});

	const dbQuery = useQuery({
		queryKey: ['stock', ''],
		queryFn: () => api.get<StockRow[]>('/api/stock'),
		staleTime: 60_000,
	});

	const comparison = useMemo(() => {
		if (!fiscalQuery.data || !dbQuery.data) return [];
		return compareItems(fiscalQuery.data, dbQuery.data);
	}, [fiscalQuery.data, dbQuery.data]);

	const stats = useMemo(() => ({
		total: comparison.length,
		matches: comparison.filter((c) => c.status === 'match').length,
		mismatches: comparison.filter((c) => c.status !== 'match' && c.status !== 'fiscal_only' && c.status !== 'db_only').length,
		fiscalOnly: comparison.filter((c) => c.status === 'fiscal_only').length,
		dbOnly: comparison.filter((c) => c.status === 'db_only').length,
	}), [comparison]);

	return {
		fiscalItems: fiscalQuery.data ?? [],
		dbProducts: (dbQuery.data ?? []).filter((p) => p.plu),
		comparison,
		stats,
		isLoading: fiscalQuery.isLoading || dbQuery.isLoading,
		isError: fiscalQuery.isError || dbQuery.isError,
		fiscalError: fiscalQuery.error,
		refetch: fiscalQuery.refetch,
	};
};
