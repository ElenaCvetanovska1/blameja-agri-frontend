'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiscalBridgeOfflineError, fiscalInfo } from 'app/lib/fiscal-bridge';

/**
 * Инфо / статус (read-only) на фискалниот уред преку FiscalBridge.
 * - retry: false — офлајн/грешка се прикажува веднаш, без бавни повторувања.
 * - refetchOnWindowFocus: false — да не се спамира сериската врска кон уредот.
 */
const COMMON = { retry: false, refetchOnWindowFocus: false } as const;

export const FISCAL_INFO_KEYS = {
	health: ['fiscal', 'health'] as const,
	ports: ['fiscal', 'ports'] as const,
	status: ['fiscal', 'device-status'] as const,
	diagnostic: ['fiscal', 'diagnostic'] as const,
	dateTime: ['fiscal', 'date-time'] as const,
};

export const useDeviceInfo = () => {
	const queryClient = useQueryClient();

	const health = useQuery({
		queryKey: FISCAL_INFO_KEYS.health,
		queryFn: fiscalInfo.getHealth,
		staleTime: 15_000,
		...COMMON,
	});

	const ports = useQuery({
		queryKey: FISCAL_INFO_KEYS.ports,
		queryFn: fiscalInfo.getPorts,
		staleTime: 15_000,
		...COMMON,
	});

	const status = useQuery({
		queryKey: FISCAL_INFO_KEYS.status,
		queryFn: fiscalInfo.getDeviceStatus,
		...COMMON,
	});

	const diagnostic = useQuery({
		queryKey: FISCAL_INFO_KEYS.diagnostic,
		queryFn: fiscalInfo.getDiagnostic,
		...COMMON,
	});

	const dateTime = useQuery({
		queryKey: FISCAL_INFO_KEYS.dateTime,
		queryFn: fiscalInfo.getDeviceDateTime,
		...COMMON,
	});

	/** FiscalBridge процесот воопшто не одговара (не работи на порт 3001). */
	const bridgeOffline = health.error instanceof FiscalBridgeOfflineError;

	const refetchAll = () =>
		Promise.allSettled([health.refetch(), ports.refetch(), status.refetch(), diagnostic.refetch(), dateTime.refetch()]);

	const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ['fiscal'] });

	return { health, ports, status, diagnostic, dateTime, bridgeOffline, refetchAll, invalidateAll };
};
