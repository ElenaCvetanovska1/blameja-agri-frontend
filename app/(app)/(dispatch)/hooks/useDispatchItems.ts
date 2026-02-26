'use client';

import { useMemo, useState } from 'react';
import type { DispatchItem, DispatchRowVM } from '../types';
import { makeEmptyItem, num, shouldPrintRow } from '../utils';

export const useDispatchItems = () => {
	const [items, setItems] = useState<DispatchItem[]>([makeEmptyItem(), makeEmptyItem(), makeEmptyItem(), makeEmptyItem()]);

	const rows: DispatchRowVM[] = useMemo(() => {
		return items.map((it, idx) => {
			const iznos = num(it.kolicina) * num(it.prodaznaCena);
			return { ...it, rb: idx + 1, iznos };
		});
	}, [items]);

	const printableRows = useMemo(() => items.filter(shouldPrintRow), [items]);

	const totalPrintable = useMemo(() => printableRows.reduce((s, it) => s + num(it.kolicina) * num(it.prodaznaCena), 0), [printableRows]);

	const updateItem = (id: string, patch: Partial<DispatchItem>) => {
		setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
	};

	const addRow = () => setItems((prev) => [...prev, makeEmptyItem()]);

	const removeRow = (id: string) => {
		setItems((prev) => {
			const next = prev.filter((x) => x.id !== id);
			while (next.length < 4) next.push(makeEmptyItem());
			return next;
		});
	};

	const reset = () => setItems([makeEmptyItem(), makeEmptyItem(), makeEmptyItem(), makeEmptyItem()]);

	return { items, rows, printableRows, totalPrintable, updateItem, addRow, removeRow, reset };
};
