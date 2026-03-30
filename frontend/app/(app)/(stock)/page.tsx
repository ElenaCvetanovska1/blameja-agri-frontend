'use client';

import { useMemo, useState } from 'react';
import { FiDatabase, FiSearch, FiFilter, FiArrowUp, FiArrowDown, FiAlertTriangle, FiPackage, FiRefreshCw } from 'react-icons/fi';
import { useStock, type StockRow } from './hooks/useStock';
import { StockTable } from './components/StockTable';
import { StockAdjustModal } from './components/StockAdjustModal';
import { DeleteProductModal } from './components/DeleteProductModal';

type SortKey = 'NAME' | 'PLU' | 'QTY' | 'CATEGORY';

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

const pluAsNumber = (plu: string | null) => {
	if (!plu || !/^\d+$/.test(plu)) return null;
	const n = Number.parseInt(plu, 10);
	return Number.isFinite(n) ? n : null;
};

export default function StockPage() {
	const [search, setSearch] = useState('');
	const [selected, setSelected] = useState<StockRow | null>(null);
	const [toDelete, setToDelete] = useState<StockRow | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string>('');
	const [sortKey, setSortKey] = useState<SortKey>('QTY');
	const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

	const stockQuery = useStock(search);
	const rows = stockQuery.data ?? [];

	const stats = useMemo(() => {
		const total = rows.length;
		const outOfStock = rows.filter((r) => num(r.qty_on_hand) <= 0).length;
		const lowStock = rows.filter((r) => {
			const q = num(r.qty_on_hand);
			return q > 0 && q <= 3;
		}).length;
		return { total, outOfStock, lowStock };
	}, [rows]);

	const categoryOptions = useMemo(() => {
		const set = new Set<string>();
		for (const r of rows) {
			const c = (r.category_name ?? '').trim();
			if (c) set.add(c);
		}
		return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'mk'));
	}, [rows]);

	const visibleRows = useMemo(() => {
		let list = [...rows];
		if (categoryFilter) list = list.filter((r) => (r.category_name ?? '') === categoryFilter);
		const dir = sortDir === 'ASC' ? 1 : -1;
		list.sort((a, b) => {
			if (sortKey === 'NAME') return dir * String(a.name ?? '').localeCompare(String(b.name ?? ''), 'mk');
			if (sortKey === 'CATEGORY') return dir * String(a.category_name ?? '').localeCompare(String(b.category_name ?? ''), 'mk');
			if (sortKey === 'PLU') {
				const pa = pluAsNumber(a.plu) ?? -1;
				const pb = pluAsNumber(b.plu) ?? -1;
				return dir * (pa - pb);
			}
			return dir * (num(a.qty_on_hand) - num(b.qty_on_hand));
		});
		return list;
	}, [rows, categoryFilter, sortKey, sortDir]);

	/* ──────────────────────────────────────────────
	   LAYOUT: flex column, full height, no outer scroll.
	   Header, stats, filters → shrink-0
	   Table → flex-1, min-h-0 (internal scroll)
	────────────────────────────────────────────── */
	return (
		<div className="flex flex-col h-full min-h-0 gap-3">
			{/* ── Header row ── */}
			<div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
				<div className="flex items-center gap-3">
					<div className="h-9 w-9 rounded-xl bg-blamejaGreenSoft flex items-center justify-center">
						<FiDatabase className="w-4 h-4 text-blamejaGreenDark" />
					</div>
					<div>
						<h1 className="text-lg font-bold text-slate-900 leading-tight">Залиха</h1>
						<p className="text-[11px] text-slate-500">Преглед и управување</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => stockQuery.refetch()}
					disabled={stockQuery.isFetching}
					className="flex items-center gap-2 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
				>
					<FiRefreshCw className={`w-3.5 h-3.5 ${stockQuery.isFetching ? 'animate-spin' : ''}`} />
					<span className="hidden sm:inline">Освежи</span>
				</button>
			</div>

			{/* ── Stats row ── */}
			<div className="grid grid-cols-3 gap-3 shrink-0">
				<div className="card px-3 py-2.5 flex items-center gap-2.5">
					<div className="h-8 w-8 rounded-lg bg-blamejaGreenSoft flex items-center justify-center shrink-0">
						<FiPackage className="w-3.5 h-3.5 text-blamejaGreenDark" />
					</div>
					<div>
						<div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Вкупно</div>
						<div className="text-xl font-extrabold text-slate-900 tabular-nums leading-tight">{stats.total}</div>
					</div>
				</div>

				<div className={`card px-3 py-2.5 flex items-center gap-2.5 ${stats.lowStock > 0 ? 'border-amber-200 bg-amber-50/40' : ''}`}>
					<div
						className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${stats.lowStock > 0 ? 'bg-amber-100' : 'bg-slate-100'}`}
					>
						<FiAlertTriangle className={`w-3.5 h-3.5 ${stats.lowStock > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
					</div>
					<div>
						<div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Мала залиха</div>
						<div
							className={`text-xl font-extrabold tabular-nums leading-tight ${stats.lowStock > 0 ? 'text-amber-700' : 'text-slate-900'}`}
						>
							{stats.lowStock}
						</div>
					</div>
				</div>

				<div className={`card px-3 py-2.5 flex items-center gap-2.5 ${stats.outOfStock > 0 ? 'border-red-200 bg-red-50/30' : ''}`}>
					<div
						className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${stats.outOfStock > 0 ? 'bg-red-100' : 'bg-slate-100'}`}
					>
						<FiPackage className={`w-3.5 h-3.5 ${stats.outOfStock > 0 ? 'text-red-500' : 'text-slate-400'}`} />
					</div>
					<div>
						<div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Без залиха</div>
						<div
							className={`text-xl font-extrabold tabular-nums leading-tight ${stats.outOfStock > 0 ? 'text-red-600' : 'text-slate-900'}`}
						>
							{stats.outOfStock}
						</div>
					</div>
				</div>
			</div>

			{/* ── Filters bar ── */}
			<div className="card px-4 py-3 shrink-0">
				<div className="flex flex-col sm:flex-row gap-2.5 items-end">
					<div className="flex-1 min-w-0">
						<label
							className="form-label flex items-center gap-1"
							htmlFor="stock-search"
						>
							<FiSearch className="w-3 h-3" />
							Пребарај
						</label>
						<div className="relative">
							<FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
							<input
								id="stock-search"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Баркод, PLU или назив…"
								className="form-input pl-9"
							/>
						</div>
					</div>

					<div className="w-full sm:w-40">
						<label
							className="form-label flex items-center gap-1"
							htmlFor="stock-category-filter"
						>
							<FiFilter className="w-3 h-3" />
							Категорија
						</label>
						<select
							id="stock-category-filter"
							value={categoryFilter}
							onChange={(e) => setCategoryFilter(e.target.value)}
							className="form-input"
						>
							<option value="">Сите</option>
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

					<div className="w-full sm:w-32">
						<label
							className="form-label"
							htmlFor="stock-sort-key"
						>
							Сортирај по
						</label>
						<select
							id="stock-sort-key"
							value={sortKey}
							onChange={(e) => setSortKey(e.target.value as SortKey)}
							className="form-input"
						>
							<option value="QTY">Залиха</option>
							<option value="NAME">Назив</option>
							<option value="PLU">PLU</option>
							<option value="CATEGORY">Категорија</option>
						</select>
					</div>

					<div>
						<div className="form-label invisible select-none">—</div>
						<button
							type="button"
							onClick={() => setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'))}
							className="flex items-center gap-1.5 h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
						>
							{sortDir === 'ASC' ? (
								<>
									<FiArrowUp className="w-4 h-4 text-blamejaGreen" />
									<span className="hidden sm:inline text-xs">Растечки</span>
								</>
							) : (
								<>
									<FiArrowDown className="w-4 h-4 text-blamejaOrange" />
									<span className="hidden sm:inline text-xs">Опаѓачки</span>
								</>
							)}
						</button>
					</div>
				</div>

				{(search || categoryFilter) && (
					<div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
						<span>Филтрирано:</span>
						{search && (
							<span className="inline-flex items-center gap-1 rounded-full bg-blamejaGreenSoft px-2 py-0.5 text-blamejaGreenDark font-medium">
								„{search}"{' '}
								<button
									type="button"
									onClick={() => setSearch('')}
									className="hover:text-red-500"
								>
									×
								</button>
							</span>
						)}
						{categoryFilter && (
							<span className="inline-flex items-center gap-1 rounded-full bg-blamejaGreenSoft px-2 py-0.5 text-blamejaGreenDark font-medium">
								{categoryFilter}{' '}
								<button
									type="button"
									onClick={() => setCategoryFilter('')}
									className="hover:text-red-500"
								>
									×
								</button>
							</span>
						)}
						<span className="text-slate-400">— {visibleRows.length} резултати</span>
					</div>
				)}
			</div>

			{/* ── Table — flex-1, fills remaining height ── */}
			<div className="flex-1 min-h-0">
				<StockTable
					rows={visibleRows}
					isLoading={stockQuery.isLoading}
					isError={stockQuery.isError}
					errorText={stockQuery.error instanceof Error ? stockQuery.error.message : 'unknown'}
					onAdjust={(r) => setSelected(r)}
					onDelete={(r) => setToDelete(r)}
				/>
			</div>

			{selected && (
				<StockAdjustModal
					open={!!selected}
					row={selected}
					onClose={() => setSelected(null)}
				/>
			)}
			{toDelete && (
				<DeleteProductModal
					open={!!toDelete}
					row={toDelete}
					onClose={() => setToDelete(null)}
				/>
			)}
		</div>
	);
}
