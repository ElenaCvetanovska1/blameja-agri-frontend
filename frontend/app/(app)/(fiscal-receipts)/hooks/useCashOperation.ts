'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { fiscalBridge, FiscalBridgeOfflineError } from 'app/lib/fiscal-bridge';

export const useCashOperation = () => {
	const [busy, setBusy] = useState(false);

	const cashIn = async (amount: number): Promise<boolean> => {
		setBusy(true);
		try {
			await fiscalBridge.cashOperation({ type: 0, amount });
			toast.success(`Готово влезно: ${amount.toFixed(2)} ден.`);
			return true;
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка при готово влезно: ${msg}`);
			}
			return false;
		} finally {
			setBusy(false);
		}
	};

	const cashOut = async (amount: number): Promise<boolean> => {
		setBusy(true);
		try {
			await fiscalBridge.cashOperation({ type: 1, amount });
			toast.success(`Готово излезно: ${amount.toFixed(2)} ден.`);
			return true;
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка при готово излезно: ${msg}`);
			}
			return false;
		} finally {
			setBusy(false);
		}
	};

	return { cashIn, cashOut, busy };
};
