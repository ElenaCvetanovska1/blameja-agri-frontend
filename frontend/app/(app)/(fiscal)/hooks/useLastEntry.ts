'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { fiscalBridge, FiscalBridgeOfflineError, type LastEntryResponse } from 'app/lib/fiscal-bridge';

export const LAST_ENTRY_TYPES: { value: number; label: string }[] = [
	{ value: 0, label: '0 — Промет по ДДВ група (стандардни)' },
	{ value: 1, label: '1 — Сторно промет по ДДВ група (стандардни)' },
	{ value: 2, label: '2 — Износ по ДДВ група (стандардни)' },
	{ value: 3, label: '3 — Сторно износ по ДДВ група (стандардни)' },
	{ value: 4, label: '4 — Промет по ДДВ група (македонски)' },
	{ value: 5, label: '5 — Сторно промет по ДДВ група (македонски)' },
	{ value: 6, label: '6 — Износ по ДДВ група (македонски)' },
	{ value: 7, label: '7 — Сторно износ по ДДВ група (македонски)' },
];

export const useLastEntry = () => {
	const [entry, setEntry] = useState<LastEntryResponse | null>(null);
	const [busy, setBusy] = useState(false);

	const fetchEntry = async (type: number) => {
		setBusy(true);
		try {
			const res = await fiscalBridge.getLastEntry(type);
			setEntry(res);
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка: ${msg}`);
			}
			setEntry(null);
		} finally {
			setBusy(false);
		}
	};

	return { entry, busy, fetchEntry };
};
