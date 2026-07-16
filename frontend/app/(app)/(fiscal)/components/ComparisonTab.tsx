'use client';

import { useState } from 'react';
import { VAT_GROUP_LABELS, fiscalErrorMessage } from 'app/lib/fiscal-bridge';
import { type ComparisonRow, type SyncStatus, taxPercentToVatGroup, useArticleComparison } from '../hooks/useArticleComparison';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const STATUS_META: Record<SyncStatus, { label: string; badge: string; dot: string }> = {
	match: { label: 'Совпаѓа', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
	diff: { label: 'Различно', badge: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
	db_only: { label: 'Само во база', badge: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500' },
	fiscal_only: { label: 'Само во каса', badge: 'text-slate-600 bg-slate-50 border-slate-200', dot: 'bg-slate-400' },
};

const money = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '—');

const vatLabel = (g: string | undefined) => (g ? (VAT_GROUP_LABELS[g] ?? g) : '—');

// ─── Tab ──────────────────────────────────────────────────────────────────────

export const ComparisonTab = () => {
	const { rows, stats, isLoading, fiscalQuery, dbQuery, syncToFiscal, removeFromFiscal, refetch } = useArticleComparison();
	const [filter, setFilter] = useState<SyncStatus | 'all'>('all');
	const [confirmDeletePlu, setConfirmDeletePlu] = useState<number | null>(null);

	if (isLoading) {
		return <div className="py-10 text-center text-sm text-slate-500">Се вчитуваат артиклите од базата и касата...</div>;
	}

	// Error handling — двата извора одделно, со точна порака
	if (fiscalQuery.isError || dbQuery.isError) {
		return (
			<div className="space-y-3">
				{fiscalQuery.isError && (
					<div className="rounded-2xl border border-red-200 bg-red-50 p-5">
						<div className="text-sm font-semibold text-red-700">Грешка при читање од КАСАТА</div>
						<div className="mt-1 text-xs text-red-600">{fiscalErrorMessage(fiscalQuery.error)}</div>
					</div>
				)}
				{dbQuery.isError && (
					<div className="rounded-2xl border border-red-200 bg-red-50 p-5">
						<div className="text-sm font-semibold text-red-700">Грешка при читање од БАЗАТА</div>
						<div className="mt-1 text-xs text-red-600">{fiscalErrorMessage(dbQuery.error)}</div>
					</div>
				)}
				<button
					type="button"
					onClick={() => void refetch()}
					className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
				>
					Обиди се повторно
				</button>
			</div>
		);
	}

	const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
	const syncingPlu = syncToFiscal.isPending ? syncToFiscal.variables?.plu : null;
	const deletingPlu = removeFromFiscal.isPending ? removeFromFiscal.variables : null;

	return (
		<div className="space-y-5">
			{/* Објаснување на целта */}
			<div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
				<strong>Базата е извор на вистината.</strong> „Синхронизирај“ ги запишува име/цена/ДДВ од базата во касата (по PLU), за фискалната
				меморија да биде иста со базата. Продажбата секогаш оди од базата.
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				{[
					{ label: 'Вкупно PLU', value: stats.total, color: 'text-slate-900' },
					{ label: 'Совпаѓаат', value: stats.matches, color: 'text-emerald-700' },
					{ label: 'Различни', value: stats.diffs, color: 'text-amber-700' },
					{ label: 'Само во база', value: stats.dbOnly, color: 'text-red-700' },
					{ label: 'Само во каса', value: stats.fiscalOnly, color: 'text-slate-600' },
				].map((s) => (
					<div
						key={s.label}
						className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm"
					>
						<div className="text-[11px] text-slate-500">{s.label}</div>
						<div className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</div>
					</div>
				))}
			</div>

			{/* Filter + refresh */}
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => setFilter('all')}
					className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filter === 'all' ? 'border-blamejaGreen bg-blamejaGreen text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
				>
					Сите ({rows.length})
				</button>
				{(Object.keys(STATUS_META) as SyncStatus[]).map((s) => {
					const cnt = rows.filter((r) => r.status === s).length;
					if (cnt === 0) return null;
					const m = STATUS_META[s];
					return (
						<button
							key={s}
							type="button"
							onClick={() => setFilter(s)}
							className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filter === s ? `ring-2 ring-blamejaGreen ring-offset-1 ${m.badge}` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
						>
							{m.label} ({cnt})
						</button>
					);
				})}
				<button
					type="button"
					onClick={() => void refetch()}
					disabled={fiscalQuery.isFetching || dbQuery.isFetching}
					className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
				>
					{fiscalQuery.isFetching || dbQuery.isFetching ? 'Читање...' : 'Освежи'}
				</button>
			</div>

			{/* Table */}
			<div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[900px] text-sm">
						<thead className="bg-slate-50 text-xs text-slate-600">
							<tr>
								<th className="px-3 py-3 text-left">PLU</th>
								<th className="px-3 py-3 text-left">Статус</th>
								<th className="px-3 py-3 text-left">Во БАЗА (име · цена · ДДВ)</th>
								<th className="px-3 py-3 text-left">Во КАСА (име · цена · ДДВ)</th>
								<th className="px-3 py-3 text-right">Акција</th>
							</tr>
						</thead>
						<tbody>
							{visible.length === 0 && (
								<tr>
									<td
										colSpan={5}
										className="px-3 py-8 text-center text-slate-400"
									>
										Нема резултати за избраниот филтер.
									</td>
								</tr>
							)}
							{visible.map((row: ComparisonRow) => {
								const m = STATUS_META[row.status];
								const syncing = syncingPlu === row.plu;
								const deleting = deletingPlu === row.plu;
								return (
									<tr
										key={row.plu}
										className="border-t border-slate-100 transition hover:bg-slate-50/50"
									>
										<td className="px-3 py-3 font-mono font-semibold text-slate-900">{row.plu}</td>
										<td className="px-3 py-3">
											<span
												className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.badge}`}
											>
												<span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
												{m.label}
											</span>
											{row.diffs.length > 0 && <div className="mt-1 text-[10px] text-amber-700">разлика: {row.diffs.join(', ')}</div>}
										</td>
										<td className="px-3 py-3">
											{row.db ? (
												<div>
													<div className="font-medium text-slate-900">{row.db.name ?? '—'}</div>
													<div className="mt-0.5 text-[11px] text-slate-500">
														{money(row.db.selling_price)} ден. · {vatLabel(taxPercentToVatGroup(row.db.tax_group))}
													</div>
												</div>
											) : (
												<span className="text-xs italic text-slate-400">нема во база</span>
											)}
										</td>
										<td className="px-3 py-3">
											{row.fiscal ? (
												<div>
													<div className="font-medium text-slate-900">{row.fiscal.name || '—'}</div>
													<div className="mt-0.5 text-[11px] text-slate-500">
														{money(row.fiscal.price)} ден. · {vatLabel(row.fiscal.vatGroup)}
													</div>
												</div>
											) : (
												<span className="text-xs italic text-slate-400">нема во каса</span>
											)}
										</td>
										<td className="px-3 py-3 text-right">
											{row.status === 'match' && <span className="text-xs font-semibold text-emerald-600">✓</span>}

											{(row.status === 'diff' || row.status === 'db_only') && (
												<button
													type="button"
													disabled={syncToFiscal.isPending}
													onClick={() => syncToFiscal.mutate(row)}
													className="rounded-lg border border-blamejaGreen bg-blamejaGreen px-3 py-1 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
												>
													{syncing ? 'Запишување...' : row.status === 'db_only' ? 'Програмирај во каса' : 'Синхронизирај во каса'}
												</button>
											)}

											{row.status === 'fiscal_only' &&
												(confirmDeletePlu === row.plu ? (
													<span className="inline-flex items-center gap-1.5">
														<span className="text-[11px] font-semibold text-red-600">Сигурен?</span>
														<button
															type="button"
															disabled={deleting}
															onClick={() => {
																setConfirmDeletePlu(null);
																removeFromFiscal.mutate(row.plu);
															}}
															className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50"
														>
															{deleting ? 'Бришење...' : 'Потврди'}
														</button>
														<button
															type="button"
															onClick={() => setConfirmDeletePlu(null)}
															className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition"
														>
															Откажи
														</button>
													</span>
												) : (
													<button
														type="button"
														disabled={removeFromFiscal.isPending}
														onClick={() => setConfirmDeletePlu(row.plu)}
														className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
													>
														Избриши од каса
													</button>
												))}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			<div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
				<div>
					<strong>Различно</strong> — ист PLU, но име/цена/ДДВ се разликуваат. „Синхронизирај“ ги препишува вредностите од базата.
				</div>
				<div>
					<strong>Само во база</strong> — производ со PLU во базата што не е програмиран во касата. „Програмирај“ го додава.
				</div>
				<div>
					<strong>Само во каса</strong> — артикал во касата без производ во базата. Може да се избрише од касата.
				</div>
				<div className="pt-1 text-slate-400">Имињата во касата се со ГОЛЕМИ букви, до 20 знаци — споредбата го зема тоа предвид.</div>
			</div>
		</div>
	);
};
