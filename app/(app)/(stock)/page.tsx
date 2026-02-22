'use client';

import { useMemo, useState } from 'react';
import { useStock, type StockRow } from './hooks/useStock';
import { StockTable } from './components/StockTable';
import { StockAdjustModal } from './components/StockAdjustModal';

type SortKey = 'NAME' | 'PLU' | 'QTY' | 'CATEGORY';

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

const pluAsNumber = (plu: string | null) => {
	if (!plu) return null;
	if (!/^\d+$/.test(plu)) return null;
	const n = Number.parseInt(plu, 10);
	return Number.isFinite(n) ? n : null;
};

export default function StockPage() {
	const [search, setSearch] = useState('');
	const [selected, setSelected] = useState<StockRow | null>(null);

	const [categoryFilter, setCategoryFilter] = useState<string>('');
	const [sortKey, setSortKey] = useState<SortKey>('NAME');
	const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

	const stockQuery = useStock(search);
	const rows = stockQuery.data ?? [];

	const stats = useMemo(() => {
		const total = rows.length;
		const outOfStock = rows.filter((r) => num(r.qty_on_hand) <= 0).length;
		return { total, outOfStock };
	}, [rows]);

	const categoryOptions = useMemo(() => {
		const set = new Set<string>();
		rows.forEach((r) => {
			const c = (r.category_name ?? '').trim();
			if (c) set.add(c);
		});
		return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'mk'));
	}, [rows]);

	const visibleRows = useMemo(() => {
		let list = [...rows];

		if (categoryFilter) {
			list = list.filter((r) => (r.category_name ?? '') === categoryFilter);
		}

		const dir = sortDir === 'ASC' ? 1 : -1;

		list.sort((a, b) => {
			if (sortKey === 'NAME') return dir * String(a.name ?? '').localeCompare(String(b.name ?? ''), 'mk');
			if (sortKey === 'CATEGORY') return dir * String(a.category_name ?? '').localeCompare(String(b.category_name ?? ''), 'mk');

			if (sortKey === 'PLU') {
				const pa = pluAsNumber(a.plu) ?? -1;
				const pb = pluAsNumber(b.plu) ?? -1;
				return dir * (pa - pb);
			}

			const qa = num(a.qty_on_hand);
			const qb = num(b.qty_on_hand);
			return dir * (qa - qb);
		});

		return list;
	}, [rows, categoryFilter, sortKey, sortDir]);

	return (
		<div className="space-y-5">
			<div className="space-y-3">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">Залиха</h1>
					<p className="mt-1 text-xs text-slate-500">
						Пребарај по PLU, баркод или име. „Корекција“ = можеш да ги смениш полињата за производот и залихата.
					</p>

					<div className="mt-2 flex flex-wrap gap-2 text-[11px]">
						<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
							Вкупно: <b>{stats.total}</b>
						</span>
						<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
							Без залиха: <b>{stats.outOfStock}</b>
						</span>
					</div>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="w-full sm:max-w-[420px]">
						<label className="block text-xs font-medium text-slate-600">Пребарај</label>
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="пр. 123, 389..., Алат..."
							className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
							focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						/>
					</div>

					<div className="w-full sm:w-[520px] space-y-2">
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
							<div>
								<label className="block text-xs font-medium text-slate-600">Филтер (категорија)</label>
								<select
									value={categoryFilter}
									onChange={(e) => setCategoryFilter(e.target.value)}
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
								>
									<option value="">Сите категории</option>
									{categoryOptions.map((c) => (
										<option
											key={c}
											value={c}
										>
											{c}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-600">Сортирај по</label>
								<select
									value={sortKey}
									onChange={(e) => setSortKey(e.target.value as SortKey)}
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
								>
									<option value="NAME">Име</option>
									<option value="PLU">PLU</option>
									<option value="QTY">Залиха</option>
									<option value="CATEGORY">Категорија</option>
								</select>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-600">Насока</label>
								<select
									value={sortDir}
									onChange={(e) => setSortDir(e.target.value as 'ASC' | 'DESC')}
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
								>
									<option value="ASC">Растечки</option>
									<option value="DESC">Опаѓачки</option>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>

			<StockTable
				rows={visibleRows}
				isLoading={stockQuery.isLoading}
				isError={stockQuery.isError}
				errorText={stockQuery.error instanceof Error ? stockQuery.error.message : 'unknown'}
				onAdjust={(r) => setSelected(r)}
			/>

			{selected && (
				<StockAdjustModal
					open={!!selected}
					row={selected}
					onClose={() => setSelected(null)}
				/>
			)}
		</div>
	);
}
