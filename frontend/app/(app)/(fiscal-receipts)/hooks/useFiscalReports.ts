'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { fiscalBridge, FiscalBridgeOfflineError } from 'app/lib/fiscal-bridge';

export const useFiscalReports = () => {
	const [xBusy, setXBusy] = useState(false);
	const [zBusy, setZBusy] = useState(false);

	const printX = async () => {
		setXBusy(true);
		try {
			await fiscalBridge.printReport({ reportType: 'X' });
			toast.success('X извештај испечатен.');
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка при X извештај: ${msg}`);
			}
		} finally {
			setXBusy(false);
		}
	};

	const printZ = async () => {
		setZBusy(true);
		try {
			await fiscalBridge.printReport({ reportType: 'Z' });
			toast.success('Z извештај (затворање на ден) испечатен.');
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка при Z извештај: ${msg}`);
			}
		} finally {
			setZBusy(false);
		}
	};

	return { printX, xBusy, printZ, zBusy };
};
