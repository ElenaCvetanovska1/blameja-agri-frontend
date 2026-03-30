'use client';

import { FiEdit3, FiTrash2, FiAlertTriangle, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import type { StockRow } from '../hooks/useStock';

const fmtQty = (n: number) =>
	Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0';

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

/* ─── Category badge ─── */
function CategoryBadge({ name }: { name: string | null }) {
	if (!name) return <span className="text-slate-400">—</span>;
	return (
		<span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
			{name}
		</span>
	);
}

/* ─── Stock status badge ─── */
function StockBadge({ qty }: { qty: number }) {
	if (qty <= 0) {
		return (
			<div className="flex items-center gap-1.5">
				<FiXCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
				<span className="badge-zero">{fmtQty(qty)}</span>
			</div>
		);
	}
	if (qty <= 3) {
		return (
			<div className="flex items-center gap-1.5">
				<FiAlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
				<span className="badge-low">{fmtQty(qty)}</span>
			</div>
		);
	}
	return (
		<div className="flex items-center gap-1.5">
			<FiCheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
			<span className="badge-ok">{fmtQty(qty)}</span>
		</div>
	);
}

export function StockTable({
	rows,
	isLoading,
	isError,
	errorText,
	onAdjust,
	onDelete,
}: {
	rows: StockRow[];
	isLoading: boolean;
	isError: boolean;
	errorText?: string;
	onAdjust: (row: StockRow) => void;
	onDelete: (row: StockRow) => void;
}) {
	return (
		<div className="card overflow-hidden h-full flex flex-col">
			<div className="flex-1 overflow-auto min-h-0">
				<table className="data-table min-w-[860px] w-full text-sm">
					<thead>
						<tr>
							<th className="w-16">PLU</th>
							<th className="w-32">Баркод</th>
							<th>Назив</th>
							<th className="w-36">Категорија</th>
							<th className="col-right w-32">Залиха</th>
							<th className="col-right w-28">Продажна</th>
							<th className="col-right w-32">Акции</th>
						</tr>
					</thead>

					<tbody>
						{isLoading && (
							<tr>
								<td colSpan={7} className="py-12 text-center text-slate-500">
									<div className="flex flex-col items-center gap-2">
										<div className="animate-spin rounded-full h-6 w-6 border-2 border-blamejaGreen border-t-transparent" />
										<span className="text-sm">Се вчитува залиха...</span>
									</div>
								</td>
							</tr>
						)}

						{isError && (
							<tr>
								<td colSpan={7} className="py-10 text-center text-red-600 text-sm">
									<FiAlertTriangle className="inline w-4 h-4 mr-1.5" />
									Грешка при вчитување: {errorText ?? 'unknown'}
								</td>
							</tr>
						)}

						{!isLoading && !isError && rows.length === 0 && (
							<tr>
								<td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
									Нема резултати за пребарувањето/филтерите.
								</td>
							</tr>
						)}

						{rows.map((r) => {
							const qoh = num(r.qty_on_hand);
							const isZero = qoh <= 0;
							const isLow = qoh > 0 && qoh <= 3;

							return (
								<tr
									key={r.product_id}
									className={isZero ? 'row-zero' : isLow ? 'row-low' : ''}
								>
									<td>
										<span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">
											{r.plu ?? '—'}
										</span>
									</td>

									<td className="text-slate-500 font-mono text-xs">
										{r.barcode ?? '—'}
									</td>

									<td>
										<span className="font-semibold text-slate-800">{r.name ?? '—'}</span>
									</td>

									<td>
										<CategoryBadge name={r.category_name ?? null} />
									</td>

									<td className="text-right">
										<StockBadge qty={qoh} />
									</td>

									<td className="text-right font-semibold text-slate-800 tabular-nums">
										{num(r.selling_price).toFixed(2)}
										<span className="ml-1 text-xs font-normal text-slate-400">ден.</span>
									</td>

									<td className="text-right">
										<div className="inline-flex items-center gap-1.5">
											<button
												type="button"
												onClick={() => onAdjust(r)}
												className="inline-flex items-center gap-1.5 rounded-xl bg-blamejaOrange px-3 py-1.5 text-xs font-semibold text-white hover:bg-blamejaOrangeDark transition-colors"
											>
												<FiEdit3 className="w-3.5 h-3.5" />
												Корекција
											</button>

											<button
												type="button"
												onClick={() => onDelete(r)}
												aria-label="Избриши производ"
												className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
											>
												<FiTrash2 className="h-3.5 w-3.5" />
											</button>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Footer row count */}
			{!isLoading && !isError && rows.length > 0 && (
				<div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
					<span>{rows.length} производи</span>
					<div className="flex items-center gap-4">
						<span className="flex items-center gap-1.5">
							<span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
							Во залиха
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
							Мала (≤3)
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block h-2 w-2 rounded-full bg-red-400" />
							Без залиха
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
