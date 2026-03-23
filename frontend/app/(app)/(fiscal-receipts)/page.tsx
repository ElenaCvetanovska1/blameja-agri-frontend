'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useFiscalReceipts, type FiscalReceiptRow } from './hooks/useFiscalReceipts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (dt: string | null) => {
	if (!dt) return '—';
	return new Date(dt).toLocaleString('mk-MK', { dateStyle: 'short', timeStyle: 'short' });
};

const mkd = (n: number) => `${Number(n).toFixed(2)} ден.`;

// ─── Badges ───────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string | null }) => {
	const map: Record<string, string> = {
		ok:      'bg-green-100 text-green-800',
		failed:  'bg-red-100 text-red-800',
		offline: 'bg-orange-100 text-orange-800',
	};
	const cls = map[status ?? ''] ?? 'bg-slate-100 text-slate-600';
	const label = status === 'ok' ? 'Успешно' : status === 'failed' ? 'Неуспешно' : status === 'offline' ? 'Офлајн' : status ?? '—';
	return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
};

const TypeBadge = ({ type }: { type: string | null }) => {
	const map: Record<string, string> = {
		sale:   'bg-blue-100 text-blue-800',
		storno: 'bg-red-100 text-red-800',
		refund: 'bg-purple-100 text-purple-800',
	};
	const cls = map[type ?? ''] ?? 'bg-slate-100 text-slate-600';
	const label = type === 'sale' ? 'Продажба' : type === 'storno' ? 'Сторно' : type === 'refund' ? 'Поврат' : type ?? '—';
	return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
};

const PaymentBadge = ({ payment }: { payment: string | null }) => {
	const cls = payment === 'CASH' ? 'bg-emerald-100 text-emerald-800' : payment === 'CARD' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600';
	const label = payment === 'CASH' ? 'Готово' : payment === 'CARD' ? 'Картичка' : payment ?? '—';
	return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FiscalReceiptsPage() {
	const navigate = useNavigate();

	const [days, setDays]         = useState(30);
	const [statusFilter, setStatusFilter] = useState('');
	const [storeFilter, setStoreFilter]   = useState('');
	const [slipSearch, setSlipSearch]     = useState('');

	const query = useFiscalReceipts(days);
	const rows: FiscalReceiptRow[] = query.data ?? [];

	const visible = useMemo(() => {
		let list = [...rows];
		if (statusFilter) list = list.filter((r) => r.fiscal_status === statusFilter);
		if (storeFilter)  list = list.filter((r) => String(r.store_no ?? '') === storeFilter);
		if (slipSearch.trim()) {
			const q = slipSearch.trim();
			list = list.filter((r) => String(r.fiscal_slip_no ?? '').includes(q));
		}
		return list;
	}, [rows, statusFilter, storeFilter, slipSearch]);

	const handleRowClick = (id: string) => navigate(`/fiscal-receipts/${id}`);

	return (
		<div className="space-y-5">
			{/* Page header */}
			<div>
				<h1 className="text-xl font-bold text-slate-800">Фискални сметки</h1>
				<p className="mt-1 text-sm text-slate-500">Архива на издадени фискални сметки</p>
			</div>

			{/* Filters */}
			<div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{/* Period */}
					<div>
						<label className="block text-xs font-medium text-slate-600" htmlFor="fr-days">
							Период
						</label>
						<select
							id="fr-days"
							value={days}
							onChange={(e) => setDays(Number(e.target.value))}
							className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						>
							<option value={7}>7 дена</option>
							<option value={30}>30 дена</option>
							<option value={90}>90 дена</option>
							<option value={365}>1 година</option>
						</select>
					</div>

					{/* Status */}
					<div>
						<label className="block text-xs font-medium text-slate-600" htmlFor="fr-status">
							Статус
						</label>
						<select
							id="fr-status"
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						>
							<option value="">Сите статуси</option>
							<option value="ok">Успешно</option>
							<option value="failed">Неуспешно</option>
							<option value="offline">Офлајн</option>
						</select>
					</div>

					{/* Store */}
					<div>
						<label className="block text-xs font-medium text-slate-600" htmlFor="fr-store">
							Продавница
						</label>
						<select
							id="fr-store"
							value={storeFilter}
							onChange={(e) => setStoreFilter(e.target.value)}
							className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						>
							<option value="">Сите продавници</option>
							<option value="20">Продавница 20</option>
							<option value="30">Продавница 30</option>
						</select>
					</div>

					{/* Slip number search */}
					<div>
						<label className="block text-xs font-medium text-slate-600" htmlFor="fr-slip">
							Бр. сметка
						</label>
						<input
							id="fr-slip"
							value={slipSearch}
							onChange={(e) => setSlipSearch(e.target.value)}
							placeholder="пр. 42"
							className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						/>
					</div>
				</div>
			</div>

			{/* Table */}
			<div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
				{query.isLoading && (
					<div className="px-6 py-10 text-center text-sm text-slate-500">Се вчитува...</div>
				)}

				{query.isError && (
					<div className="px-6 py-10 text-center text-sm text-red-500">
						Грешка при вчитување:{' '}
						{query.error instanceof Error ? query.error.message : 'непозната грешка'}
					</div>
				)}

				{!query.isLoading && !query.isError && visible.length === 0 && (
					<div className="px-6 py-10 text-center text-sm text-slate-500">
						Нема фискални сметки за избраните филтери.
					</div>
				)}

				{!query.isLoading && !query.isError && visible.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
									<th className="px-4 py-3">Датум</th>
									<th className="px-4 py-3">Сметка бр.</th>
									<th className="px-4 py-3">Тип</th>
									<th className="px-4 py-3">Статус</th>
									<th className="px-4 py-3">Плаќање</th>
									<th className="px-4 py-3 text-right">Вкупно</th>
									<th className="px-4 py-3 text-center">Продавница</th>
									<th className="px-4 py-3 text-center">Акција</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{visible.map((row) => (
									<tr
										key={row.id}
										onClick={() => handleRowClick(row.id)}
										className="hover:bg-slate-50 cursor-pointer transition-colors"
									>
										<td className="px-4 py-3 text-slate-700 whitespace-nowrap">
											{fmtDate(row.fiscalized_at ?? row.created_at)}
										</td>
										<td className="px-4 py-3 font-mono font-semibold text-slate-800">
											{row.fiscal_slip_no ?? <span className="text-slate-400">—</span>}
										</td>
										<td className="px-4 py-3">
											<TypeBadge type={row.receipt_type} />
										</td>
										<td className="px-4 py-3">
											<StatusBadge status={row.fiscal_status} />
										</td>
										<td className="px-4 py-3">
											<PaymentBadge payment={row.payment} />
										</td>
										<td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
											{mkd(row.total)}
										</td>
										<td className="px-4 py-3 text-center text-slate-600">
											{row.store_no ?? '—'}
										</td>
										<td className="px-4 py-3 text-center">
											<button
												type="button"
												onClick={(e) => { e.stopPropagation(); handleRowClick(row.id); }}
												className="rounded-full bg-blamejaGreen px-3 py-1 text-xs font-semibold text-white hover:bg-blamejaGreen/90 transition-colors"
											>
												Прегледај
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Footer count */}
			{!query.isLoading && !query.isError && (
				<div className="flex flex-wrap gap-2 text-[11px]">
					<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
						Прикажани: <b>{visible.length}</b>
					</span>
					<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
						Вкупно во периодот: <b>{rows.length}</b>
					</span>
				</div>
			)}
		</div>
	);
}
