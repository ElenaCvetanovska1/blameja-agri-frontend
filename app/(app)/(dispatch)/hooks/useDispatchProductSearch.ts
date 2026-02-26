'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from 'app/lib/supabase-client';
import type { ProductLookupRow, ProductSuggestion } from '../types';
import { normalizeSuggestion } from '../utils';

const isDigits = (s: string) => /^\d+$/.test(s);

const searchProducts = async (term: string, limit = 8): Promise<ProductSuggestion[]> => {
	const t0 = term.trim();
	if (t0.length < 1) return [];

	const base = await supabase
		.from('products')
		.select('id, plu, barcode, name, unit, selling_price')
		.or(`name.ilike.%${t0}%,plu.ilike.%${t0}%,barcode.ilike.%${t0}%`)
		.limit(limit);

	if (base.error) throw base.error;

	let exact: ProductLookupRow[] = [];
	if (isDigits(t0)) {
		const ex = await supabase.from('products').select('id, plu, barcode, name, unit, selling_price').eq('plu', t0).limit(limit);
		if (ex.error) throw ex.error;
		exact = (ex.data ?? []) as ProductLookupRow[];
	}

	const combined = [...(exact ?? []), ...((base.data ?? []) as ProductLookupRow[])];

	const map = new Map<string, ProductLookupRow>();
	for (const r of combined) map.set(String(r.id), r);

	return Array.from(map.values()).map(normalizeSuggestion).slice(0, limit);
};

export type UseDispatchProductSearchArgs = {
	term: string;
	limit?: number;
};

export const useDispatchProductSearch = ({ term, limit = 8 }: UseDispatchProductSearchArgs) => {
	const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const debounceRef = useRef<number | null>(null);

	useEffect(() => {
		const t = term.trim();

		if (debounceRef.current) window.clearTimeout(debounceRef.current);

		if (t.length < 1) {
			setSuggestions([]);
			setOpen(false);
			setLoading(false);
			return;
		}

		setLoading(true);

		debounceRef.current = window.setTimeout(async () => {
			try {
				const res = await searchProducts(t, limit);
				setSuggestions(res);
				setOpen(res.length > 0);
			} catch (e) {
				console.error(e);
				setSuggestions([]);
				setOpen(false);
			} finally {
				setLoading(false);
			}
		}, 220);

		return () => {
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
		};
	}, [term, limit]);

	return { suggestions, open, setOpen, loading, setSuggestions };
};
