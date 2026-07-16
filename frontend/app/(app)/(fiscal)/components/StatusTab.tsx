'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, type UseQueryResult } from '@tanstack/react-query';
import {
	type FiscalCommandResult,
	fiscalErrorMessage,
	fiscalInfo,
	isDeviceStatusClean,
	parseDiagnosticText,
	parseFiscalDateTime,
} from 'app/lib/fiscal-bridge';
import { useDeviceInfo } from '../hooks/useDeviceInfo';

// ─── UI primitives ────────────────────────────────────────────────────────────

const Card = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
	<div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
		<div className="mb-4">
			<div className="text-sm font-semibold text-slate-900">{title}</div>
			{sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
		</div>
		{children}
	</div>
);

const Dot = ({ ok }: { ok: boolean }) => (
	<span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
);

const Badge = ({ tone, children }: { tone: 'green' | 'red' | 'amber' | 'slate'; children: React.ReactNode }) => {
	const cls = {
		green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
		red: 'bg-red-50 text-red-700 border-red-200',
		amber: 'bg-amber-50 text-amber-800 border-amber-200',
		slate: 'bg-slate-50 text-slate-600 border-slate-200',
	}[tone];
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
			{children}
		</span>
	);
};

const RefreshBtn = ({ busy, onClick }: { busy: boolean; onClick: () => void }) => (
	<button
		type="button"
		onClick={onClick}
		disabled={busy}
		className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
	>
		{busy ? 'Читање...' : 'Освежи'}
	</button>
);

/** Задолжителен error-панел: точна порака + повторен обид. */
const ErrorPanel = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
	<div className="rounded-xl border border-red-200 bg-red-50 p-4">
		<div className="flex items-start gap-2">
			<span className="mt-0.5 text-red-500">⚠</span>
			<div className="min-w-0 flex-1">
				<div className="text-xs font-semibold text-red-700">Грешка при комуникација со фискалниот уред</div>
				<div className="mt-1 break-words text-xs text-red-600">{fiscalErrorMessage(error)}</div>
			</div>
		</div>
		<button
			type="button"
			onClick={onRetry}
			className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
		>
			Обиди се повторно
		</button>
	</div>
);

const Skeleton = () => <div className="h-20 animate-pulse rounded-xl bg-slate-100" />;

const KV = ({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) => (
	<div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
		<span className="shrink-0 text-[11px] text-slate-500">{k}</span>
		<span className={`min-w-0 break-all text-right text-xs font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{v}</span>
	</div>
);

/**
 * Заедничка обвивка за query-картичка: скелет при вчитување, ErrorPanel при грешка,
 * инаку содржина. Гарантира дека корисникот СЕКОГАШ гледа кога нешто не е во ред.
 */
function QuerySection<T>({ query, label, children }: { query: UseQueryResult<T>; label: string; children: (data: T) => React.ReactNode }) {
	if (query.isPending) return <Skeleton />;
	if (query.isError) {
		return (
			<ErrorPanel
				error={query.error}
				onRetry={() => {
					void query.refetch().then((r) => {
						if (r.status === 'error') toast.error(`${label}: ${fiscalErrorMessage(r.error)}`);
					});
				}}
			/>
		);
	}
	return <>{children(query.data as T)}</>;
}

/** Ред „команда → одговор“ за read-only команда, со success=false руте. */
const CommandMeta = ({ res }: { res: FiscalCommandResult }) => (
	<div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-400 font-mono break-all">
		{res.commandName} ({res.commandIdHex}) · {res.responseStatus} · {res.elapsedMs}ms
	</div>
);

// ─── Cards ────────────────────────────────────────────────────────────────────

const BridgeCard = () => {
	const { health, ports, bridgeOffline } = useDeviceInfo();
	const [selectedPort, setSelectedPort] = useState<string | null>(null);

	const refetchBoth = () => {
		void Promise.allSettled([health.refetch(), ports.refetch()]).then((results) => {
			const failed = results.find((r) => r.status === 'fulfilled' && r.value.status === 'error');
			if (failed && failed.status === 'fulfilled') toast.error(fiscalErrorMessage(failed.value.error));
		});
	};

	return (
		<Card
			title="FiscalBridge врска"
			sub="Локалната апликација што комуницира со касата (порт 3001)."
		>
			{bridgeOffline ? (
				<ErrorPanel
					error={health.error}
					onRetry={refetchBoth}
				/>
			) : (
				<QuerySection
					query={health}
					label="FiscalBridge"
				>
					{(h) => {
						const availablePorts = ports.data ?? [];
						const portMissing = ports.isSuccess && !availablePorts.includes(h.comPort);
						const shownPort = selectedPort ?? h.comPort;
						return (
							<div>
								<div className="mb-3 flex flex-wrap items-center gap-2">
									<Badge tone="green">
										<Dot ok /> Онлајн
									</Badge>
									{h.dryRun ? <Badge tone="amber">DryRun режим — не се печати реално</Badge> : <Badge tone="green">Реален режим</Badge>}
									<Badge tone="slate">{h.deviceType}</Badge>
								</div>

								<KV
									k="COM порт (конфигуриран)"
									v={h.comPort}
									mono
								/>
								<KV
									k="Брзина"
									v={`${h.baudRate} baud`}
									mono
								/>
								<KV
									k="Поддржани команди"
									v={h.supportedCommands.length}
								/>

								<div className="mt-3">
									<label
										htmlFor="fiscal-port-select"
										className="mb-1 block text-[11px] font-medium text-slate-600"
									>
										Достапни COM портови на машината
									</label>
									{ports.isError ? (
										<ErrorPanel
											error={ports.error}
											onRetry={() => void ports.refetch()}
										/>
									) : (
										<select
											id="fiscal-port-select"
											value={shownPort}
											onChange={(e) => setSelectedPort(e.target.value)}
											className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blamejaGreen"
										>
											{availablePorts.map((p) => (
												<option
													key={p}
													value={p}
												>
													{p}
													{p === h.comPort ? ' (активен)' : ''}
												</option>
											))}
											{availablePorts.length === 0 && <option value={h.comPort}>{h.comPort} (нема детектирани портови)</option>}
										</select>
									)}
									{portMissing && (
										<div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
											Конфигурираниот порт {h.comPort} не е меѓу достапните! Провери кабел/уред.
										</div>
									)}
									<p className="mt-2 text-[11px] text-slate-400">
										Промена на порт: appsettings.json → FiscalBridge:ComPort, па рестарт на FiscalBridge.
									</p>
								</div>

								<div className="mt-4">
									<RefreshBtn
										busy={health.isFetching || ports.isFetching}
										onClick={refetchBoth}
									/>
								</div>
							</div>
						);
					}}
				</QuerySection>
			)}
		</Card>
	);
};

const DeviceStatusCard = () => {
	const { status } = useDeviceInfo();

	return (
		<Card
			title="Статус на уредот"
			sub="GET_STATUS_BYTES — моментална состојба на касата."
		>
			<QuerySection
				query={status}
				label="Статус"
			>
				{(res) => {
					const clean = res.success && isDeviceStatusClean(res.statusBytes);
					return (
						<div>
							<div className="mb-3">
								{res.success ? (
									clean ? (
										<Badge tone="green">
											<Dot ok /> Уредот е подготвен
										</Badge>
									) : (
										<Badge tone="amber">
											<Dot ok={false} /> Уредот пријавува состојба — провери ги статус бајтите
										</Badge>
									)
								) : (
									<Badge tone="red">
										<Dot ok={false} /> {res.error || res.message || `Грешка (${res.responseStatus})`}
									</Badge>
								)}
							</div>
							<KV
								k="Статус бајти"
								v={res.statusHex || '—'}
								mono
							/>
							<CommandMeta res={res} />
							<div className="mt-4">
								<RefreshBtn
									busy={status.isFetching}
									onClick={() =>
										void status.refetch().then((r) => {
											if (r.status === 'error') toast.error(fiscalErrorMessage(r.error));
										})
									}
								/>
							</div>
						</div>
					);
				}}
			</QuerySection>
		</Card>
	);
};

const DiagnosticCard = () => {
	const { diagnostic } = useDeviceInfo();

	return (
		<Card
			title="Дијагностика"
			sub="Модел, firmware и сериски број на касата."
		>
			<QuerySection
				query={diagnostic}
				label="Дијагностика"
			>
				{(res) => {
					if (!res.success) {
						return (
							<div>
								<Badge tone="red">
									<Dot ok={false} /> {res.error || res.message || `Грешка (${res.responseStatus})`}
								</Badge>
								<CommandMeta res={res} />
							</div>
						);
					}
					const d = parseDiagnosticText(res.dataText);
					return (
						<div>
							<KV
								k="Модел"
								v={d.model || '—'}
							/>
							<KV
								k="Firmware"
								v={d.firmware || '—'}
								mono
							/>
							<KV
								k="Сериски број"
								v={d.serialNumber || '—'}
								mono
							/>
							<KV
								k="Checksum"
								v={d.checksum || '—'}
								mono
							/>
							<CommandMeta res={res} />
							<div className="mt-4">
								<RefreshBtn
									busy={diagnostic.isFetching}
									onClick={() =>
										void diagnostic.refetch().then((r) => {
											if (r.status === 'error') toast.error(fiscalErrorMessage(r.error));
										})
									}
								/>
							</div>
						</div>
					);
				}}
			</QuerySection>
		</Card>
	);
};

const DateTimeCard = () => {
	const { dateTime } = useDeviceInfo();

	// SET_DATE_TIME (0x3D): празно тело → FiscalBridge го зема системското време на машината.
	const sync = useMutation({
		mutationFn: () => fiscalInfo.setDeviceDateTime(),
		onSuccess: () => {
			toast.success('Датум и час на касата синхронизирани со системот.');
			void dateTime.refetch();
		},
		onError: (err) => toast.error(`Синхронизација неуспешна: ${fiscalErrorMessage(err)}`),
	});

	return (
		<Card
			title="Датум и час на уредот"
			sub="Споредба со системскиот часовник, со можност за синхронизација."
		>
			<QuerySection
				query={dateTime}
				label="Датум/час"
			>
				{(res) => {
					if (!res.success) {
						return (
							<div>
								<Badge tone="red">
									<Dot ok={false} /> {res.error || res.message || `Грешка (${res.responseStatus})`}
								</Badge>
								<CommandMeta res={res} />
							</div>
						);
					}
					const deviceDate = parseFiscalDateTime(res.dataText);
					const drift = deviceDate ? Math.abs(Math.round((Date.now() - deviceDate.getTime()) / 1000)) : null;
					const driftHigh = drift !== null && drift > 60;
					return (
						<div>
							<div className="mb-3 grid gap-3 sm:grid-cols-2">
								<div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
									<div className="mb-1 text-[11px] text-slate-500">Фискален уред</div>
									<div className="text-base font-semibold text-slate-900">{res.dataText || '—'}</div>
								</div>
								<div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
									<div className="mb-1 text-[11px] text-slate-500">Системски часовник</div>
									<div className="text-base font-semibold text-slate-900">{new Date().toLocaleString()}</div>
								</div>
							</div>
							{drift !== null && (
								<div
									className={`rounded-lg border px-3 py-2 text-sm font-medium ${driftHigh ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
								>
									{driftHigh ? `Разлика: ${drift}s — се препорачува синхронизација.` : `Разлика: ${drift}s — во ред.`}
								</div>
							)}
							<CommandMeta res={res} />
							<div className="mt-4 flex flex-wrap items-center gap-2">
								<RefreshBtn
									busy={dateTime.isFetching}
									onClick={() =>
										void dateTime.refetch().then((r) => {
											if (r.status === 'error') toast.error(fiscalErrorMessage(r.error));
										})
									}
								/>
								<button
									type="button"
									disabled={sync.isPending || dateTime.isFetching}
									onClick={() => sync.mutate()}
									className="rounded-lg border border-blamejaGreen bg-blamejaGreen px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
								>
									{sync.isPending ? 'Синхронизирање...' : 'Синхронизирај со системот'}
								</button>
							</div>
						</div>
					);
				}}
			</QuerySection>
		</Card>
	);
};

const PaperCard = () => {
	const feed = useMutation({
		mutationFn: () => fiscalInfo.feedPaper(),
		onSuccess: () => toast.success('Лентата е извлечена — може да ја откинеш.'),
		onError: (err) => toast.error(`Извлекување лента неуспешно: ${fiscalErrorMessage(err)}`),
	});

	return (
		<Card
			title="Лента"
			sub="Извлечи ја лентата за да откинеш заглавено/недовршено ливче (не-фискална команда)."
		>
			<button
				type="button"
				disabled={feed.isPending}
				onClick={() => feed.mutate()}
				className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
			>
				{feed.isPending ? 'Извлекување...' : 'Извлечи лента'}
			</button>
		</Card>
	);
};

// ─── Tab ──────────────────────────────────────────────────────────────────────

export const StatusTab = () => {
	const { bridgeOffline, refetchAll, health } = useDeviceInfo();

	return (
		<div className="space-y-5">
			{bridgeOffline && (
				<div className="rounded-2xl border border-red-200 bg-red-50 p-4">
					<div className="text-sm font-semibold text-red-700">FiscalBridge не е достапен</div>
					<div className="mt-1 text-xs text-red-600">{fiscalErrorMessage(health.error)}</div>
					<button
						type="button"
						onClick={() => void refetchAll()}
						className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
					>
						Обиди се повторно
					</button>
				</div>
			)}

			<div className="grid gap-5 lg:grid-cols-2">
				<BridgeCard />
				<DeviceStatusCard />
				<DiagnosticCard />
				<DateTimeCard />
				<PaperCard />
			</div>
		</div>
	);
};
