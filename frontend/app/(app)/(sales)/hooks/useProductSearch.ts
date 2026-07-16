'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from 'app/lib/api-client';
import type { ProductStockRow } from '../types';
import { num } from '../utils';

const searchProducts = async (term: string, storeNo: 20 | 30, limit = 8): Promise<ProductStockRow[]> => {
	const t0 = term.trim();
	if (t0.length < 1) return [];

	const rows = await api.get<ProductStockRow[]>(`/api/sales/products/search?q=${encodeURIComponent(t0)}&storeNo=${storeNo}&limit=${limit}`);

	// Точен PLU погодок секогаш прв (пр. „50" → производот со PLU 50 на врв), потоа по залиха.
	const pluExact = /^\d+$/.test(t0) ? t0 : null;
	return (rows ?? []).sort((a, b) => {
		const aExact = pluExact != null && String(a.plu ?? '') === pluExact ? 0 : 1;
		const bExact = pluExact != null && String(b.plu ?? '') === pluExact ? 0 : 1;
		if (aExact !== bExact) return aExact - bExact;
		return num(b.qty_on_hand) - num(a.qty_on_hand);
	});
};

export const useProductSearch = (code: string, storeNo: 20 | 30) => {
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
				const res = await searchProducts(t, storeNo, 8);
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
	}, [code, storeNo]);

	return {
		suggestions,
		suggestOpen,
		setSuggestOpen,
		suggestLoading,
		setSuggestions,
	};
};
