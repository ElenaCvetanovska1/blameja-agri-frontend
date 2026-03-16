'use client';

import { useMemo, useState } from 'react';
import { useDailySales } from './hooks/useDailySales';
import { useTopProducts } from './hooks/useTopProducts';
import { useFiscalReports } from './hooks/useFiscalReports';
import { useCashOperation } from './hooks/useCashOperation';

// ✅ IMPORTANT: rename helper so it doesn't conflict with { toISO } from buildRange()
const toIsoString = (d: Date) => d.toISOString();

const money = (n: number) => {
	const x = Number.isFinite(n) ? n : 0;
	return x.toFixed(2);
};

const fmtQty = (n: number) => {
	if (!Number.isFinite(n)) return '0';
	const s = n.toFixed(3);
	return s.replace(/\.?0+$/, '');
};

const parseDayLabel = (dayISO: string) => {
	const d = new Date(`${dayISO}T00:00:00`);
	if (Number.isNaN(d.getTime())) return dayISO;
	return d.toLocaleDateString();
};

const pct = (a: number, b: number) => {
	if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
	return ((a - b) / b) * 100;
};

const buildRange = (daysBack: number) => {
	const now = new Date();

	const to = new Date(now);
	to.setHours(24, 0, 0, 0);

	const from = new Date(now);
	from.setHours(0, 0, 0, 0);
	from.setDate(from.getDate() - (daysBack - 1));

	return { fromISO: toIsoString(from), toISO: toIsoString(to) };
};

const sumTotals = (rows: Array<{ total: number }>) => rows.reduce((acc, r) => acc + (Number.isFinite(r.total) ? r.total : 0), 0);

const maxBy = <T,>(arr: T[], get: (t: T) => number) => {
	if (arr.length === 0) return null;
	let best = arr[0];
	let bestVal = get(best);
	for (const x of arr) {
		const v = get(x);
		if (v > bestVal) {
			best = x;
			bestVal = v;
		}
	}
	return best;
};

const minBy = <T,>(arr: T[], get: (t: T) => number) => {
	if (arr.length === 0) return null;
	let best = arr[0];
	let bestVal = get(best);
	for (const x of arr) {
		const v = get(x);
		if (v < bestVal) {
			best = x;
			bestVal = v;
		}
	}
	return best;
};

const FinancePage = () => {
	const [daysBack, setDaysBack] = useState<7 | 14 | 30>(14);
	const [zConfirm, setZConfirm] = useState(false);
	const [cashAmountStr, setCashAmountStr] = useState('');
	const { printX, xBusy, printZ, zBusy } = useFiscalReports();
	const { cashIn, cashOut, busy: cashBusy } = useCashOperation();

	const { fromISO, toISO } = useMemo(() => buildRange(daysBack), [daysBack]);

	const dailyQuery = useDailySales(fromISO, toISO);
	const topQuery = useTopProducts(fromISO, toISO, 8);

	const daily = dailyQuery.data ?? [];
	const top = topQuery.data ?? [];

	const prevPeriod = useMemo(() => {
		const now = new Date();

		const currentFrom = new Date(now);
		currentFrom.setHours(0, 0, 0, 0);
		currentFrom.setDate(currentFrom.getDate() - (daysBack - 1));

		const prevTo = new Date(currentFrom);
		const prevFrom = new Date(currentFrom);
		prevFrom.setDate(prevFrom.getDate() - daysBack);

		return { fromISO: toIsoString(prevFrom), toISO: toIsoString(prevTo) };
	}, [daysBack]);

	const prevDailyQuery = useDailySales(prevPeriod.fromISO, prevPeriod.toISO);
	const prevDaily = prevDailyQuery.data ?? [];

	const maxTotal = useMemo(() => {
		const m = maxBy(daily, (r) => r.total);
		return m?.total ?? 0;
	}, [daily]);

	const kpis = useMemo(() => {
		const total = sumTotals(daily);
		const avg = daily.length > 0 ? total / daily.length : 0;

		const bestDay = maxBy(daily, (r) => r.total);
		const worstDay = minBy(daily, (r) => r.total);

		const topProduct = top.length > 0 ? top[0] : null;

		return { total, avg, bestDay, worstDay, topProduct };
	}, [daily, top]);

	const growth = useMemo(() => {
		const curr = sumTotals(daily);
		const prev = sumTotals(prevDaily);
		const g = pct(curr, prev);
		return { curr, prev, g };
	}, [daily, prevDaily]);

	const noSalesNow = !dailyQuery.isLoading && !dailyQuery.isError && kpis.total <= 0;

	return (
		<div className="space-y-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Финансии</h1>
					<p className="mt-1 text-xs text-slate-500">Дневен преглед на продажба наназад + најпродавани производи (кратка анализа).</p>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setDaysBack(7)}
						className={[
							'rounded-full px-4 py-2 text-xs font-semibold border transition',
							daysBack === 7
								? 'bg-blamejaGreen text-white border-blamejaGreen'
								: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
						].join(' ')}
					>
						7 дена
					</button>

					<button
						type="button"
						onClick={() => setDaysBack(14)}
						className={[
							'rounded-full px-4 py-2 text-xs font-semibold border transition',
							daysBack === 14
								? 'bg-blamejaGreen text-white border-blamejaGreen'
								: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
						].join(' ')}
					>
						14 дена
					</button>

					<button
						type="button"
						onClick={() => setDaysBack(30)}
						className={[
							'rounded-full px-4 py-2 text-xs font-semibold border transition',
							daysBack === 30
								? 'bg-blamejaGreen text-white border-blamejaGreen'
								: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
						].join(' ')}
					>
						30 дена
					</button>
				</div>
			</div>

			{/* KPI RECTANGLES */}
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
				<div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
					<div className="text-[11px] text-slate-500">Вкупно (период)</div>
					<div className="mt-1 text-xl font-bold text-slate-900">
						{dailyQuery.isLoading ? '—' : noSalesNow ? 'Моментално нема продажба' : `${money(kpis.total)} ден.`}
					</div>
				</div>

				<div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
					<div className="text-[11px] text-slate-500">Просек / ден</div>
					<div className="mt-1 text-xl font-bold text-slate-900">{dailyQuery.isLoading ? '—' : `${money(kpis.avg)} ден.`}</div>
				</div>

				<div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
					<div className="text-[11px] text-slate-500">Најдобар ден</div>
					<div className="mt-1 text-sm font-semibold text-slate-900">{kpis.bestDay ? parseDayLabel(kpis.bestDay.day) : '—'}</div>
					<div className="mt-1 text-lg font-bold text-blamejaGreenDark">{kpis.bestDay ? `${money(kpis.bestDay.total)} ден.` : '—'}</div>
				</div>

				<div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
					<div className="text-[11px] text-slate-500">Најслаб ден</div>
					<div className="mt-1 text-sm font-semibold text-slate-900">{kpis.worstDay ? parseDayLabel(kpis.worstDay.day) : '—'}</div>
					<div className="mt-1 text-lg font-bold text-blamejaOrangeDark">{kpis.worstDay ? `${money(kpis.worstDay.total)} ден.` : '—'}</div>
				</div>

				<div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
					<div className="text-[11px] text-slate-500">Најпродавано</div>
					<div className="mt-1 text-sm font-semibold text-slate-900 line-clamp-2">{kpis.topProduct ? kpis.topProduct.name : '—'}</div>
					<div className="mt-1 text-xs text-slate-500">{kpis.topProduct ? `qty: ${fmtQty(kpis.topProduct.qty)}` : ''}</div>
				</div>

				<div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
					<div className="text-[11px] text-slate-500">Промена vs претходен период</div>
					<div className="mt-1 text-xl font-bold text-slate-900">
						{prevDailyQuery.isLoading || dailyQuery.isLoading
							? '—'
							: growth.g === null
								? '—'
								: `${growth.g >= 0 ? '+' : ''}${growth.g.toFixed(1)}%`}
					</div>
					<div className="mt-1 text-[11px] text-slate-500">
						{prevDailyQuery.isLoading || dailyQuery.isLoading ? '' : `претходно: ${money(growth.prev)} ден.`}
					</div>
				</div>
			</div>

			{/* DAILY SALES */}
			<div className="grid gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2 rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
					<div className="px-4 py-3 border-b border-slate-100">
						<div className="text-sm font-semibold text-slate-900">Продажба по ден</div>
						<div className="text-xs text-slate-500">Секој ред е ден. Лентата е релативно (според најдобриот ден во периодот).</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-[720px] w-full text-sm">
							<thead className="bg-slate-50 text-slate-600 text-xs">
								<tr>
									<th className="px-3 py-3 text-left">Ден</th>
									<th className="px-3 py-3 text-right">Сметки</th>
									<th className="px-3 py-3 text-right">Вкупно</th>
									<th className="px-3 py-3 text-left">Тренд</th>
									<th className="px-3 py-3 text-right">vs вчера</th>
								</tr>
							</thead>

							<tbody>
								{dailyQuery.isLoading && (
									<tr>
										<td
											colSpan={5}
											className="px-3 py-8 text-center text-slate-500"
										>
											Се вчитува...
										</td>
									</tr>
								)}

								{dailyQuery.isError && (
									<tr>
										<td
											colSpan={5}
											className="px-3 py-8 text-center text-red-600"
										>
											Грешка: {dailyQuery.error instanceof Error ? dailyQuery.error.message : 'unknown'}
										</td>
									</tr>
								)}

								{!dailyQuery.isLoading && !dailyQuery.isError && daily.length === 0 && (
									<tr>
										<td
											colSpan={5}
											className="px-3 py-10 text-center text-slate-500"
										>
											Нема продажба за периодот.
										</td>
									</tr>
								)}

								{daily.map((r, idx) => {
									const prev = idx > 0 ? daily[idx - 1] : null;
									const delta = prev ? pct(r.total, prev.total) : null;

									const widthPct = maxTotal > 0 ? Math.max(2, Math.round((r.total / maxTotal) * 100)) : 0;

									const deltaLabel = delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;

									const deltaClass = delta === null ? 'text-slate-400' : delta >= 0 ? 'text-blamejaGreenDark' : 'text-blamejaOrangeDark';

									return (
										<tr
											key={r.day}
											className="border-t border-slate-100"
										>
											<td className="px-3 py-3 text-slate-700">{parseDayLabel(r.day)}</td>
											<td className="px-3 py-3 text-right text-slate-700">{r.receipts_count}</td>
											<td className="px-3 py-3 text-right font-semibold text-slate-900">{money(r.total)}</td>
											<td className="px-3 py-3">
												<div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
													<div
														className="h-2 rounded-full bg-blamejaGreen"
														style={{ width: `${widthPct}%` }}
													/>
												</div>
											</td>
											<td className={`px-3 py-3 text-right font-semibold ${deltaClass}`}>{deltaLabel}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>

				{/* TOP PRODUCTS */}
				<div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
					<div className="px-4 py-3 border-b border-slate-100">
						<div className="text-sm font-semibold text-slate-900">Најпродавани</div>
						<div className="text-xs text-slate-500">Топ 8 според приход.</div>
					</div>

					<div className="p-4 space-y-3">
						{topQuery.isLoading && <div className="text-sm text-slate-500">Се вчитува...</div>}

						{topQuery.isError && (
							<div className="text-sm text-red-600">Грешка: {topQuery.error instanceof Error ? topQuery.error.message : 'unknown'}</div>
						)}

						{!topQuery.isLoading && !topQuery.isError && top.length === 0 && (
							<div className="text-sm text-slate-500">Нема ставки за периодот.</div>
						)}

						{top.map((p, i) => {
							const badge = i === 0 ? 'bg-blamejaOrange text-white' : 'bg-slate-100 text-slate-700';

							return (
								<div
									key={p.product_id}
									className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="text-sm font-semibold text-slate-900 line-clamp-2">{p.name}</div>
											<div className="mt-1 text-[11px] text-slate-500">
												PLU: <span className="font-medium text-slate-700">{p.plu ?? '—'}</span>
											</div>
										</div>

										<span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge}`}>#{i + 1}</span>
									</div>

									<div className="mt-3 flex items-center justify-between text-[12px]">
										<span className="text-slate-600">
											qty: <b className="text-slate-900">{fmtQty(p.qty)}</b>
										</span>
										<span className="text-slate-600">
											revenue: <b className="text-slate-900">{money(p.revenue)}</b>
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* NOTE BOX */}
			<div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
				<div className="text-sm font-semibold text-slate-900">Брза анализа</div>

				<div className="mt-2 text-xs text-slate-600 space-y-1">
					<div>• Ако растот е негативен: провери дали имало денови со 0 сметки (можеби нема внесови или имало затворено).</div>
					<div>
						• „Најпродавано" го рангираме по <b>приходи</b> (не само по qty) — за да видиш што носи најмногу пари.
					</div>
					<div>• „Best day" е ден со највисок total — ако често е ист ден во недела, можеме да додадеме „best weekday" анализа.</div>
				</div>
			</div>

			{/* CASH IN / CASH OUT */}
			<div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
				<div className="text-sm font-semibold text-slate-900">Готово влезно / излезно</div>
				<div className="mt-1 text-xs text-slate-500">Регистрирај влез или излез на пари во фискалниот уред.</div>

				<div className="mt-4 flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<label className="text-xs font-medium text-slate-600">Износ (ден.)</label>
						<input
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

					<button
						type="button"
						disabled={cashBusy}
						onClick={async () => {
							const amount = parseFloat(cashAmountStr);
							if (!Number.isFinite(amount) || amount <= 0) return;
							const ok = await cashIn(amount);
							if (ok) setCashAmountStr('');
						}}
						className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition"
					>
						{cashBusy ? 'Обработка...' : 'Готово влезно'}
					</button>

					<button
						type="button"
						disabled={cashBusy}
						onClick={async () => {
							const amount = parseFloat(cashAmountStr);
							if (!Number.isFinite(amount) || amount <= 0) return;
							const ok = await cashOut(amount);
							if (ok) setCashAmountStr('');
						}}
						className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition"
					>
						{cashBusy ? 'Обработка...' : 'Готово излезно'}
					</button>
				</div>
			</div>

			{/* FISCAL REPORTS */}
			<div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
				<div className="text-sm font-semibold text-slate-900">Фискални извештаи</div>
				<div className="mt-1 text-xs text-slate-500">
					X извештај = дневен преглед без затворање. Z извештај = затворање на ден (неповратно).
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-3">
					<button
						type="button"
						onClick={() => void printX()}
						disabled={xBusy || zBusy}
						className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
					>
						{xBusy ? 'Печатење...' : 'X извештај'}
					</button>

					{!zConfirm ? (
						<button
							type="button"
							onClick={() => setZConfirm(true)}
							disabled={xBusy || zBusy}
							className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition"
						>
							Z извештај (затвори ден)
						</button>
					) : (
						<div className="flex items-center gap-2">
							<span className="text-xs font-semibold text-red-600">Сигурен? Ова е неповратно.</span>
							<button
								type="button"
								onClick={async () => {
									setZConfirm(false);
									await printZ();
								}}
								disabled={zBusy}
								className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
							>
								{zBusy ? 'Печатење...' : 'Потврди Z'}
							</button>
							<button
								type="button"
								onClick={() => setZConfirm(false)}
								className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
							>
								Откажи
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default FinancePage;
