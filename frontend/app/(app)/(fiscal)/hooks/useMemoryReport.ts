'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { fiscalBridge, FiscalBridgeOfflineError, type MemoryReportByDateRequest, type MemoryReportByZRequest } from 'app/lib/fiscal-bridge';

export const useMemoryReport = () => {
	const [dateBusy, setDateBusy] = useState(false);
	const [zBusy, setZBusy] = useState(false);

	const printByDate = async (req: MemoryReportByDateRequest) => {
		setDateBusy(true);
		try {
			await fiscalBridge.memoryReportByDate(req);
			toast.success('Извештај по датум испечатен.');
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка: ${msg}`);
			}
		} finally {
			setDateBusy(false);
		}
	};

	const printByZ = async (req: MemoryReportByZRequest) => {
		setZBusy(true);
		try {
			await fiscalBridge.memoryReportByZ(req);
			toast.success('Извештај по Z-број испечатен.');
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка: ${msg}`);
			}
		} finally {
			setZBusy(false);
		}
	};

	return { dateBusy, zBusy, printByDate, printByZ };
};
