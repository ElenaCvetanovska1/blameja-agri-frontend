'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from 'app/lib/api-client';
import type { ProductSuggestion } from '../types';

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
				const rows = await api.get<ProductSuggestion[]>(`/api/dispatch/products/search?q=${encodeURIComponent(t)}&limit=${limit}`);
				setSuggestions(rows ?? []);
				setOpen((rows?.length ?? 0) > 0);
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
