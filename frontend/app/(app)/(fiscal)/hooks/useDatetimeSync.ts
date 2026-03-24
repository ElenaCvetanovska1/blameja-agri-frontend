'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { fiscalBridge, FiscalBridgeOfflineError } from 'app/lib/fiscal-bridge';

/** Parse "DD-MM-YY hh:mm:ss [DST]" → Date, or null on failure. */
export function parseFiscalDateTime(s: string): Date | null {
	const m = s.match(/(\d{2})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
	if (!m) return null;
	const [, dd, mm, yy, hh, min, ss] = m;
	return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
}

/** Format a Date → "DD-MM-YY hh:mm:ss" for SY55 Command 61h. */
export function toFiscalDateTimeStr(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export type DatetimeSyncState = {
	deviceTimeStr: string | null;
	deviceTime: Date | null;
	driftSeconds: number | null;
	readBusy: boolean;
	syncBusy: boolean;
	readDateTime: () => Promise<void>;
	syncNow: () => Promise<void>;
};

export const useDatetimeSync = (): DatetimeSyncState => {
	const [deviceTimeStr, setDeviceTimeStr] = useState<string | null>(null);
	const [deviceTime, setDeviceTime] = useState<Date | null>(null);
	const [driftSeconds, setDriftSeconds] = useState<number | null>(null);
	const [readBusy, setReadBusy] = useState(false);
	const [syncBusy, setSyncBusy] = useState(false);

	const readDateTime = async () => {
		setReadBusy(true);
		try {
			const res = await fiscalBridge.getDateTime();
			const raw = res.DateTime ?? null;
			setDeviceTimeStr(raw);
			if (raw) {
				const dt = parseFiscalDateTime(raw);
				setDeviceTime(dt);
				const drift = dt ? Math.round((Date.now() - dt.getTime()) / 1000) : null;
				setDriftSeconds(drift);
			} else {
				setDeviceTime(null);
				setDriftSeconds(null);
			}
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка при читање на датум/час: ${msg}`);
			}
		} finally {
			setReadBusy(false);
		}
	};

	const syncNow = async () => {
		setSyncBusy(true);
		try {
			const now = new Date();
			await fiscalBridge.setDateTime({ dateTime: toFiscalDateTimeStr(now) });
			toast.success('Датум и час успешно синхронизирани.');
			// Re-read to confirm
			await readDateTime();
		} catch (err) {
			if (err instanceof FiscalBridgeOfflineError) {
				toast.error('Фискалниот уред е офлајн.');
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Грешка при синхронизација: ${msg}`);
			}
		} finally {
			setSyncBusy(false);
		}
	};

	return { deviceTimeStr, deviceTime, driftSeconds, readBusy, syncBusy, readDateTime, syncNow };
};
