'use client';

import { useEffect, useState, useCallback } from 'react';
import { fiscalBridge } from 'app/lib/fiscal-bridge';

export type FiscalDeviceStatus = 'checking' | 'online' | 'warning' | 'offline';

type FiscalStatusResult = {
	status: FiscalDeviceStatus;
	warnings: string[];
	refresh: () => void;
};

export function useFiscalStatus(): FiscalStatusResult {
	const [status, setStatus] = useState<FiscalDeviceStatus>('checking');
	const [warnings, setWarnings] = useState<string[]>([]);

	const check = useCallback(async () => {
		try {
			const res = await fiscalBridge.getStatus();
			if (!res.IsConnected) {
				setStatus('offline');
				setWarnings([]);
				return;
			}
			const w: string[] = [];
			if (res.EndOfPaper)         w.push('Нема хартија');
			if (res.EjNearlyFull)       w.push('Журнал скоро полн');
			if (res.EjFull)             w.push('Журнал полн');
			if (res.FiscalMemoryFull)   w.push('Фискална меморија полна');
			if (res.LessThan50Reports)  w.push('Помалку од 50 Z-извештаи');

			setWarnings(w);
			setStatus(w.length > 0 ? 'warning' : 'online');
		} catch {
			setStatus('offline');
			setWarnings([]);
		}
	}, []);

	useEffect(() => {
		// Check once on mount
		void check();

		// Re-check when user returns to the tab/window (e.g. after fixing paper)
		const onFocus = () => void check();
		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	}, [check]);

	return { status, warnings, refresh: check };
}
