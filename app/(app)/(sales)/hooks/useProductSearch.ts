'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from 'app/lib/supabase-client';
import type { ProductStockRow } from '../types';
import { escapeLike, parseDigitsText, num } from '../utils';

const searchProducts = async (term: string, limit = 8): Promise<ProductStockRow[]> => {
	const t0 = term.trim();
	if (t0.length < 1) return [];

	const t = escapeLike(t0);
	const pluText = parseDigitsText(t0);

	const baseQuery = supabase
		.from('product_stock')
		.select('product_id, plu, barcode, name, selling_price, qty_on_hand, category_name')
		.or(`barcode.ilike.%${t}%,name.ilike.%${t}%,plu.ilike.%${t}%`)
		// ✅ SORT by stock (most first)
		.order('qty_on_hand', { ascending: false, nullsFirst: false })
		.limit(limit);

	const pluQuery =
		pluText !== null
			? supabase
					.from('product_stock')
					.select('product_id, plu, barcode, name, selling_price, qty_on_hand, category_name')
					.eq('plu', pluText)
					// ✅ also sort (not super important for eq, but consistent)
					.order('qty_on_hand', { ascending: false, nullsFirst: false })
					.limit(limit)
			: null;

	const [{ data: baseData, error: baseErr }, pluRes] = await Promise.all([
		baseQuery,
		pluQuery ?? Promise.resolve({ data: [], error: null } as any),
	]);

	if (baseErr) throw baseErr;
	if (pluRes?.error) throw pluRes.error;

	const combined = [...(baseData ?? []), ...(pluRes?.data ?? [])] as ProductStockRow[];

	// ✅ dedupe by product_id
	const map = new Map<string, ProductStockRow>();
	combined.forEach((r) => map.set(r.product_id, r));
	const deduped = Array.from(map.values());

	// ✅ final sort safeguard (after merge/dedupe): by stock desc
	deduped.sort((a, b) => num(b.qty_on_hand) - num(a.qty_on_hand));

	return deduped.slice(0, limit);
};

export const useProductSearch = (code: string) => {
	const [suggestions, setSuggestions] = useState<ProductStockRow[]>([]);
	const [suggestOpen, setSuggestOpen] = useState(false);
	const [suggestLoading, setSuggestLoading] = useState(false);
	const debounceRef = useRef<number | null>(null);

	useEffect(() => {
		const t = code.trim();

		if (debounceRef.current) window.clearTimeout(debounceRef.current);

		if (t.length < 1) {
			setSuggestions([]);
			setSuggestOpen(false);
			setSuggestLoading(false);
			return;
		}

		setSuggestLoading(true);

		debounceRef.current = window.setTimeout(async () => {
			try {
				const res = await searchProducts(t, 8);
				setSuggestions(res);
				setSuggestOpen(res.length > 0);
			} catch (e) {
				console.error(e);
				setSuggestions([]);
				setSuggestOpen(false);
			} finally {
				setSuggestLoading(false);
			}
		}, 250);

		return () => {
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
		};
	}, [code]);

	return {
		suggestions,
		suggestOpen,
		setSuggestOpen,
		suggestLoading,
		setSuggestions,
	};
};