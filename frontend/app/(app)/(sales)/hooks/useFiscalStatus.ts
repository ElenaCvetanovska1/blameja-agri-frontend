'use client';

import { useCallback, useEffect, useState } from 'react';
import { fiscalErrorMessage, fiscalInfo, isDeviceStatusClean, parseFiscalDateTime } from 'app/lib/fiscal-bridge';

export type FiscalDeviceStatus = 'checking' | 'online' | 'warning' | 'offline';

type FiscalStatusResult = {
	status: FiscalDeviceStatus;
	warnings: string[];
	refresh: () => void;
};

/** Праг за предупредување за отстапување на часот (секунди). */
const CLOCK_DRIFT_WARN_SECONDS = 60;

/**
 * Статус badge за фискалната каса (продажба страница).
 * - GET /status (0x4A): офлајн/грешка → offline + причина; статус битови → warning.
 * - GET /date-time (0x3E): ако часот на касата отстапува > 60s → жолто предупредување
 *   „синхронизирај во Фискална → Статус“. САМО известува — никогаш не менува ништо.
 */
export function useFiscalStatus(): FiscalStatusResult {
	const [status, setStatus] = useState<FiscalDeviceStatus>('checking');
	const [warnings, setWarnings] = useState<string[]>([]);

	const check = useCallback(async () => {
		try {
			const res = await fiscalInfo.getDeviceStatus();

			if (!res.success) {
				setStatus('offline');
				setWarnings([res.error || res.message || `Касата не одговара (${res.responseStatus}).`]);
				return;
			}

			// Проверка на часот — read-only; неуспехот тука не го менува статусот на уредот.
			let driftWarning: string | null = null;
			try {
				const dt = await fiscalInfo.getDeviceDateTime();
				if (dt.success) {
					const deviceDate = parseFiscalDateTime(dt.dataText);
					if (deviceDate) {
						const driftSeconds = Math.abs(Math.round((Date.now() - deviceDate.getTime()) / 1000));
						if (driftSeconds > CLOCK_DRIFT_WARN_SECONDS) {
							driftWarning = `Часот на касата отстапува ${driftSeconds} сек. — синхронизирај во Фискална → Статус.`;
						}
					}
				}
			} catch {
				// Часот е споредна проверка — грешка тука не значи дека касата е офлајн.
			}

			const newWarnings: string[] = [];
			if (!isDeviceStatusClean(res.statusBytes)) {
				newWarnings.push(`Касата пријавува состојба — статус бајти: ${res.statusHex}. Провери хартија/отворена сметка.`);
			}
			if (driftWarning) {
				newWarnings.push(driftWarning);
			}

			setWarnings(newWarnings);
			setStatus(newWarnings.length > 0 ? 'warning' : 'online');
		} catch (err) {
			setStatus('offline');
			setWarnings([fiscalErrorMessage(err)]);
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
