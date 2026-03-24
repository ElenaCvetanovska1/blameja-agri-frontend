'use client';

import { useState, useEffect } from 'react';
import { useFiscalReports } from 'app/(app)/(finance)/hooks/useFiscalReports';
import { useCashOperation } from 'app/(app)/(finance)/hooks/useCashOperation';
import { useDatetimeSync } from './hooks/useDatetimeSync';
import { useLastEntry, LAST_ENTRY_TYPES } from './hooks/useLastEntry';
import { useMemoryReport } from './hooks/useMemoryReport';
import { useFiscalItemsQuery, type CompareStatus } from './hooks/useFiscalItemsQuery';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (s: string | number | null | undefined) => {
	const n = typeof s === 'string' ? parseFloat(s) : Number(s);
	return Number.isFinite(n) ? n.toFixed(2) : '—';
};

const absDrift = (s: number | null) => {
	if (s === null) return null;
	return Math.abs(s);
};

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'reports' | 'device' | 'memory' | 'items';

const TABS: { id: Tab; label: string }[] = [
	{ id: 'reports', label: 'Извештаи' },
	{ id: 'device',  label: 'Уред' },
	{ id: 'memory',  label: 'Меморија' },
	{ id: 'items',   label: 'Артикли' },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
	<div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
		<div className="mb-4">
			<div className="text-sm font-semibold text-slate-900">{title}</div>
			{sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
		</div>
		{children}
	</div>
);

const Btn = ({
	onClick,
	disabled,
	variant = 'default',
	children,
}: {
	onClick: () => void;
	disabled?: boolean;
	variant?: 'default' | 'primary' | 'danger' | 'success';
	children: React.ReactNode;
}) => {
	const cls = {
		default:  'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
		primary:  'border border-blamejaGreen bg-blamejaGreen text-white hover:brightness-110',
		danger:   'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
		success:  'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
	}[variant];
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${cls}`}
		>
			{children}
		</button>
	);
};

// ─── Tab: Извештаи ────────────────────────────────────────────────────────────

const ReportsTab = () => {
	const [zConfirm, setZConfirm] = useState(false);
	const [cashAmountStr, setCashAmountStr] = useState('');
	const { printX, xBusy, printZ, zBusy } = useFiscalReports();
	const { cashIn, cashOut, busy: cashBusy } = useCashOperation();

	const cashAmount = Number.parseFloat(cashAmountStr);
	const cashValid = Number.isFinite(cashAmount) && cashAmount > 0;

	return (
		<div className="space-y-5">
			{/* X / Z reports */}
			<Section
				title="X и Z Извештаи"
				sub="X = дневен преглед без затворање. Z = затворање на ден (неповратно)."
			>
				<div className="flex flex-wrap items-center gap-3">
					<Btn onClick={() => void printX()} disabled={xBusy || zBusy}>
						{xBusy ? 'Печатење...' : 'X извештај'}
					</Btn>

					{!zConfirm ? (
						<Btn onClick={() => setZConfirm(true)} disabled={xBusy || zBusy} variant="danger">
							Z извештај (затвори ден)
						</Btn>
					) : (
						<div className="flex items-center gap-2">
							<span className="text-xs font-semibold text-red-600">Сигурен? Ова е неповратно.</span>
							<Btn
								onClick={async () => { setZConfirm(false); await printZ(); }}
								disabled={zBusy}
								variant="danger"
							>
								{zBusy ? 'Печатење...' : 'Потврди Z'}
							</Btn>
							<Btn onClick={() => setZConfirm(false)}>Откажи</Btn>
						</div>
					)}
				</div>
			</Section>

			{/* Cash in / Cash out */}
			<Section
				title="Готово влезно / излезно"
				sub="Регистрирај влез или излез на готовина во фискалниот уред."
			>
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600" htmlFor="fiscal-cash-amount">
							Износ (ден.)
						</label>
						<input
							id="fiscal-cash-amount"
							type="number"
							min="0.01"
							step="0.01"
							placeholder="0.00"
							value={cashAmountStr}
							onChange={(e) => setCashAmountStr(e.target.value)}
							disabled={cashBusy}
							className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50"
						/>
					</div>

					<Btn
						variant="success"
						disabled={cashBusy || !cashValid}
						onClick={async () => {
							const ok = await cashIn(cashAmount);
							if (ok) setCashAmountStr('');
						}}
					>
						{cashBusy ? 'Обработка...' : 'Готово влезно'}
					</Btn>

					<Btn
						variant="danger"
						disabled={cashBusy || !cashValid}
						onClick={async () => {
							const ok = await cashOut(cashAmount);
							if (ok) setCashAmountStr('');
						}}
					>
						{cashBusy ? 'Обработка...' : 'Готово излезно'}
					</Btn>
				</div>
			</Section>
		</div>
	);
};

// ─── Tab: Уред ────────────────────────────────────────────────────────────────

const DeviceTab = () => {
	const { deviceTimeStr, deviceTime, driftSeconds, readBusy, syncBusy, readDateTime, syncNow } = useDatetimeSync();
	const { entry, busy: entryBusy, fetchEntry } = useLastEntry();
	const [entryType, setEntryType] = useState(0);

	// Auto-read datetime on first render
	useEffect(() => { void readDateTime(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

	const drift = absDrift(driftSeconds);
	const driftHigh = drift !== null && drift > 60;
	const nowStr = new Date().toLocaleString();

	const sumRows: { label: string; value: string | undefined }[] = [
		{ label: 'А (18%)', value: entry?.SumA },
		{ label: 'Б (5%)',  value: entry?.SumB },
		{ label: 'В (10%)', value: entry?.SumC },
		{ label: 'Г (0%)',  value: entry?.SumD },
	];

	return (
		<div className="space-y-5">
			{/* Datetime sync */}
			<Section
				title="Датум и час на фискалниот уред"
				sub="Читај го тековниот датум/час, и синхронизирај со системскиот часовник."
			>
				<div className="grid gap-3 sm:grid-cols-2 mb-4">
					<div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
						<div className="text-[11px] text-slate-500 mb-1">Фискален уред</div>
						<div className="text-base font-semibold text-slate-900">
							{readBusy ? 'Читање...' : (deviceTimeStr ?? '—')}
						</div>
					</div>
					<div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
						<div className="text-[11px] text-slate-500 mb-1">Системски часовник</div>
						<div className="text-base font-semibold text-slate-900">{nowStr}</div>
					</div>
				</div>

				{drift !== null && (
					<div className={`mb-4 rounded-lg px-3 py-2 text-sm font-medium ${driftHigh ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
						{driftHigh
							? `Разлика: ${drift}s — Се препорачува синхронизација.`
							: `Разлика: ${drift}s — Во ред.`}
					</div>
				)}

				<div className="flex flex-wrap gap-3">
					<Btn onClick={() => void readDateTime()} disabled={readBusy || syncBusy}>
						{readBusy ? 'Читање...' : 'Прочитај'}
					</Btn>
					<Btn onClick={() => void syncNow()} disabled={readBusy || syncBusy} variant="primary">
						{syncBusy ? 'Синхронизирање...' : 'Синхронизирај со системот'}
					</Btn>
				</div>
			</Section>

			{/* Last fiscal entry */}
			<Section
				title="Последен фискален запис"
				sub="Дијагностика — ги враќа збировите по ДДВ групи за последниот З-извештај."
			>
				<div className="flex flex-wrap items-end gap-3 mb-4">
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600" htmlFor="last-entry-type">
							Тип на податоци
						</label>
						<select
							id="last-entry-type"
							value={entryType}
							onChange={(e) => setEntryType(Number(e.target.value))}
							disabled={entryBusy}
							className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50 min-w-[280px]"
						>
							{LAST_ENTRY_TYPES.map((t) => (
								<option key={t.value} value={t.value}>{t.label}</option>
							))}
						</select>
					</div>
					<Btn onClick={() => void fetchEntry(entryType)} disabled={entryBusy}>
						{entryBusy ? 'Читање...' : 'Прочитај'}
					</Btn>
				</div>

				{entry && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm border-collapse">
							<thead>
								<tr className="bg-slate-50 text-slate-600 text-xs">
									<th className="px-3 py-2 text-left border border-slate-100">Поле</th>
									<th className="px-3 py-2 text-left border border-slate-100">Вредност</th>
								</tr>
							</thead>
							<tbody>
								<tr className="border-b border-slate-100">
									<td className="px-3 py-2 text-slate-500 text-xs">Број на извештај</td>
									<td className="px-3 py-2 font-semibold text-slate-900">{entry.NRep ?? '—'}</td>
								</tr>
								<tr className="border-b border-slate-100">
									<td className="px-3 py-2 text-slate-500 text-xs">Датум</td>
									<td className="px-3 py-2 font-semibold text-slate-900">{entry.Date ?? '—'}</td>
								</tr>
								{sumRows.map((r) => (
									<tr key={r.label} className="border-b border-slate-100">
										<td className="px-3 py-2 text-slate-500 text-xs">ДДВ {r.label}</td>
										<td className="px-3 py-2 font-semibold text-slate-900">{r.value ?? '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Section>
		</div>
	);
};

// ─── Tab: Меморија ────────────────────────────────────────────────────────────

const MemoryTab = () => {
	const { dateBusy, zBusy, printByDate, printByZ } = useMemoryReport();

	// Date report state
	const [dateType, setDateType] = useState<0 | 1>(0);
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');

	// Z report state
	const [zType, setZType] = useState<0 | 1>(0);
	const [zFirst, setZFirst] = useState('');
	const [zLast, setZLast] = useState('');

	const todayFiscal = () => {
		const d = new Date();
		const p = (n: number) => String(n).padStart(2, '0');
		return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${String(d.getFullYear()).slice(-2)}`;
	};

	return (
		<div className="space-y-5">
			<div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
				Меморискиот извештај се печати директно на касата — нема дигитален резултат во апликацијата.
			</div>

			{/* By date */}
			<Section
				title="Извештај по датум (94h)"
				sub="Печати фискална меморија за избран датумски опсег."
			>
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600">Тип</label>
						<select
							value={dateType}
							onChange={(e) => setDateType(Number(e.target.value) as 0 | 1)}
							disabled={dateBusy}
							className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50"
						>
							<option value={0}>Краток</option>
							<option value={1}>Детален</option>
						</select>
					</div>

					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600">Почетен датум (DD-MM-YY)</label>
						<input
							type="text"
							placeholder={todayFiscal()}
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							disabled={dateBusy}
							className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50"
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600">Краен датум (DD-MM-YY)</label>
						<input
							type="text"
							placeholder={todayFiscal()}
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							disabled={dateBusy}
							className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50"
						/>
					</div>

					<Btn
						onClick={() => void printByDate({
							type: dateType,
							start: startDate || undefined,
							end: endDate || undefined,
						})}
						disabled={dateBusy}
						variant="primary"
					>
						{dateBusy ? 'Печатење...' : 'Печати'}
					</Btn>
				</div>
				<p className="mt-3 text-[11px] text-slate-400">
					Ако оставиш празни полиња: почеток = датум на фискализација, крај = денес.
				</p>
			</Section>

			{/* By Z-report number */}
			<Section
				title="Извештај по З-број (95h)"
				sub="Печати фискална меморија за опсег на Z-извештаи."
			>
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600">Тип</label>
						<select
							value={zType}
							onChange={(e) => setZType(Number(e.target.value) as 0 | 1)}
							disabled={zBusy}
							className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50"
						>
							<option value={0}>Краток</option>
							<option value={1}>Детален</option>
						</select>
					</div>

					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600">Прв Z-број</label>
						<input
							type="number"
							min="1"
							placeholder="1"
							value={zFirst}
							onChange={(e) => setZFirst(e.target.value)}
							disabled={zBusy}
							className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50"
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600">Последен Z-број</label>
						<input
							type="number"
							min="1"
							placeholder="последен"
							value={zLast}
							onChange={(e) => setZLast(e.target.value)}
							disabled={zBusy}
							className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50"
						/>
					</div>

					<Btn
						onClick={() => void printByZ({
							type: zType,
							first: zFirst ? Number(zFirst) : undefined,
							last: zLast ? Number(zLast) : undefined,
						})}
						disabled={zBusy}
						variant="primary"
					>
						{zBusy ? 'Печатење...' : 'Печати'}
					</Btn>
				</div>
				<p className="mt-3 text-[11px] text-slate-400">
					Ако оставиш празни полиња: прв = 1, последен = последниот Z-извештај.
				</p>
			</Section>
		</div>
	);
};

// ─── Tab: Артикли ─────────────────────────────────────────────────────────────

const STATUS_META: Record<CompareStatus, { label: string; color: string; dot: string }> = {
	match:          { label: 'Се совпаѓа',       color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
	name_mismatch:  { label: 'Различно Име',      color: 'text-amber-700 bg-amber-50 border-amber-200',       dot: 'bg-amber-400'   },
	price_mismatch: { label: 'Различна Цена',     color: 'text-amber-700 bg-amber-50 border-amber-200',       dot: 'bg-amber-400'   },
	both_mismatch:  { label: 'Различно Ime+Цена', color: 'text-orange-700 bg-orange-50 border-orange-200',    dot: 'bg-orange-500'  },
	fiscal_only:    { label: 'Само во каса',      color: 'text-slate-600 bg-slate-50 border-slate-200',       dot: 'bg-slate-400'   },
	db_only:        { label: 'Само во база',      color: 'text-red-700 bg-red-50 border-red-200',             dot: 'bg-red-500'     },
};

const ItemsTab = () => {
	const { comparison, stats, isLoading, isError, fiscalError, refetch, fiscalItems } = useFiscalItemsQuery();
	const [filter, setFilter] = useState<CompareStatus | 'all'>('all');

	const visible = filter === 'all' ? comparison : comparison.filter((c) => c.status === filter);

	if (isLoading) {
		return <div className="py-10 text-center text-slate-500 text-sm">Се вчитуваат артикли...</div>;
	}

	if (isError) {
		return (
			<div className="rounded-2xl border border-red-200 bg-red-50 p-5">
				<div className="text-sm font-semibold text-red-700 mb-1">Грешка при вчитување</div>
				<div className="text-xs text-red-600">{fiscalError instanceof Error ? fiscalError.message : 'Провери дали фискалниот уред е поврзан.'}</div>
				<button type="button" onClick={() => void refetch()} className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition">
					Обиди се повторно
				</button>
			</div>
		);
	}

	if (fiscalItems.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
				<div className="text-3xl mb-3">📋</div>
				<div className="text-sm font-semibold text-slate-700">Нема артикли во фискалниот уред</div>
				<div className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
					Уредот работи во режим на директна регистрација по Ime+Цена. Артикли треба да се внесат само ако тоа е законски потребно.
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			{/* Stats row */}
			<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
				{[
					{ label: 'Вкупно', value: stats.total, color: 'text-slate-900' },
					{ label: 'Совпаѓаат', value: stats.matches, color: 'text-emerald-700' },
					{ label: 'Несовпаѓање', value: stats.mismatches, color: 'text-amber-700' },
					{ label: 'Само во каса', value: stats.fiscalOnly, color: 'text-slate-600' },
					{ label: 'Само во база', value: stats.dbOnly, color: 'text-red-700' },
				].map((s) => (
					<div key={s.label} className="rounded-xl border border-slate-100 bg-white shadow-sm p-3 text-center">
						<div className="text-[11px] text-slate-500">{s.label}</div>
						<div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
					</div>
				))}
			</div>

			{/* Filter */}
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => setFilter('all')}
					className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${filter === 'all' ? 'bg-blamejaGreen text-white border-blamejaGreen' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
				>
					Сите ({comparison.length})
				</button>
				{(Object.keys(STATUS_META) as CompareStatus[]).map((s) => {
					const cnt = comparison.filter((c) => c.status === s).length;
					if (cnt === 0) return null;
					const m = STATUS_META[s];
					return (
						<button
							key={s}
							type="button"
							onClick={() => setFilter(s)}
							className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${filter === s ? 'ring-2 ring-offset-1 ring-blamejaGreen ' + m.color : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
						>
							{m.label} ({cnt})
						</button>
					);
				})}
				<button
					type="button"
					onClick={() => void refetch()}
					className="ml-auto rounded-full px-3 py-1 text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
				>
					Освежи
				</button>
			</div>

			{/* Table */}
			<div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="min-w-[820px] w-full text-sm">
						<thead className="bg-slate-50 text-slate-600 text-xs">
							<tr>
								<th className="px-3 py-3 text-left">PLU</th>
								<th className="px-3 py-3 text-left">Статус</th>
								<th className="px-3 py-3 text-left">Во касата (Ime / ДДВ / Цена)</th>
								<th className="px-3 py-3 text-left">Во база (Ime / Цена)</th>
								<th className="px-3 py-3 text-right">Промет</th>
								<th className="px-3 py-3 text-right">Продадено</th>
							</tr>
						</thead>
						<tbody>
							{visible.length === 0 && (
								<tr>
									<td colSpan={6} className="px-3 py-8 text-center text-slate-400">
										Нема резултати за избраниот филтер.
									</td>
								</tr>
							)}
							{visible.map((row) => {
								const m = STATUS_META[row.status];
								const taxLabel = row.fiscalItem
									? ['', 'А 18%', 'Б 5%', 'В 10%', 'Г 0%'][row.fiscalItem.TaxGr] ?? String(row.fiscalItem.TaxGr)
									: '—';
								return (
									<tr key={row.plu} className="border-t border-slate-100 hover:bg-slate-50/50 transition">
										<td className="px-3 py-3 font-mono font-semibold text-slate-900">{row.plu}</td>
										<td className="px-3 py-3">
											<span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${m.color}`}>
												<span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
												{m.label}
											</span>
										</td>
										<td className="px-3 py-3">
											{row.fiscalItem ? (
												<div>
													<div className="font-medium text-slate-900">{row.fiscalItem.Name}</div>
													<div className="text-[11px] text-slate-500 mt-0.5">
														{taxLabel} · {money(row.fiscalItem.Price)} ден.
													</div>
												</div>
											) : (
												<span className="text-slate-400 text-xs italic">нема</span>
											)}
										</td>
										<td className="px-3 py-3">
											{row.dbProduct ? (
												<div>
													<div className="font-medium text-slate-900">{row.dbProduct.name ?? '—'}</div>
													<div className="text-[11px] text-slate-500 mt-0.5">
														{money(row.dbProduct.selling_price)} ден.
													</div>
												</div>
											) : (
												<span className="text-slate-400 text-xs italic">нема PLU во база</span>
											)}
										</td>
										<td className="px-3 py-3 text-right text-slate-700 text-xs">
											{row.fiscalItem ? `${money(row.fiscalItem.Turnover)} ден.` : '—'}
										</td>
										<td className="px-3 py-3 text-right text-slate-700 text-xs">
											{row.fiscalItem?.SoldQty ?? '—'}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* Help note */}
			<div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
				<div><strong>Само во каса</strong> — Артикл програмиран во касата, но нема соодветен PLU во базата.</div>
				<div><strong>Само во база</strong> — Производот во базата има PLU, но тој PLU не е програмиран во касата.</div>
				<div><strong>Несовпаѓање</strong> — PLU се наоѓа и во касата и во базата, но Ime или Цена се разликуваат.</div>
				<div className="pt-1 text-slate-400">Артиклите може да се програмираат рачно директно на касата (Програмирање → Артикл).</div>
			</div>
		</div>
	);
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const FiscalPage = () => {
	const [tab, setTab] = useState<Tab>('reports');

	return (
		<div className="space-y-5 pb-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-slate-900">Фискална</h1>
				<p className="mt-1 text-xs text-slate-500">
					Извештаи · Готово влезно/излезно · Синхронизација на часовник · Меморија · Артикли
				</p>
			</div>

			{/* Tabs */}
			<div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-full sm:w-fit">
				{TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						onClick={() => setTab(t.id)}
						className={[
							'rounded-lg px-4 py-2 text-sm font-semibold transition',
							tab === t.id
								? 'bg-white text-slate-900 shadow-sm'
								: 'text-slate-600 hover:text-slate-900',
						].join(' ')}
					>
						{t.label}
					</button>
				))}
			</div>

			{/* Content */}
			{tab === 'reports' && <ReportsTab />}
			{tab === 'device'  && <DeviceTab />}
			{tab === 'memory'  && <MemoryTab />}
			{tab === 'items'   && <ItemsTab />}
		</div>
	);
};

export default FiscalPage;
