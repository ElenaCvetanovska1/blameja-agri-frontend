'use client';

import type { StockRow } from '../hooks/useStock';
import { FiTrash2 } from 'react-icons/fi';

const fmtQty = (n: number) =>
	Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0';

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

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
		<div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
			<div className="max-h-[560px] overflow-auto">
				<table className="min-w-[900px] w-full text-sm">
					<thead className="bg-slate-50 text-slate-600 text-xs sticky top-0 z-10">
						<tr>
							<th className="px-3 py-3 text-left">PLU</th>
							<th className="px-3 py-3 text-left">Баркод</th>
							<th className="px-3 py-3 text-left">Име</th>
							<th className="px-3 py-3 text-left">Категорија</th>
							<th className="px-3 py-3 text-right">Залиха</th>
							<th className="px-3 py-3 text-right">Продажна</th>
							<th className="px-3 py-3 text-right">Акции</th>
						</tr>
					</thead>

					<tbody>
						{isLoading && (
							<tr>
								<td colSpan={7} className="px-3 py-6 text-center text-slate-500">
									Се вчитува залиха...
								</td>
							</tr>
						)}

						{isError && (
							<tr>
								<td colSpan={7} className="px-3 py-6 text-center text-red-600">
									Грешка при вчитување: {errorText ?? 'unknown'}
								</td>
							</tr>
						)}

						{!isLoading && !isError && rows.length === 0 && (
							<tr>
								<td colSpan={7} className="px-3 py-10 text-center text-slate-500">
									Нема резултати за пребарувањето/филтерите.
								</td>
							</tr>
						)}

						{rows.map((r) => {
							const qoh = num(r.qty_on_hand);
							const low = qoh > 0 && qoh <= 3;
							const zero = qoh <= 0;

							return (
								<tr key={r.product_id} className="border-t border-slate-100">   
									<td className="px-3 py-3 font-medium text-slate-900">{r.plu ?? '—'}</td>
									<td className="px-3 py-3 text-slate-600">{r.barcode ?? '—'}</td>
									<td className="px-3 py-3 text-slate-900">{r.name ?? '—'}</td>
									<td className="px-3 py-3 text-slate-600">
										{r.category_name ?? '—'}
									</td>

									<td className="px-3 py-3 text-right">
										<span
											className={[
												'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
												zero
													? 'bg-red-50 text-red-700 border border-red-100'
													: low
													? 'bg-blamejaOrangeSoft text-blamejaOrangeDark border border-amber-100'
													: 'bg-blamejaGreenSoft text-blamejaGreenDark border border-emerald-100',
											].join(' ')}
										>
											{fmtQty(qoh)}
										</span>
									</td>

									<td className="px-3 py-3 text-right text-slate-700">
										{num(r.selling_price).toFixed(2)}
									</td>

									<td className="px-3 py-3 text-right">
										<div className="inline-flex items-center gap-2">
											<button
												type="button"
												onClick={() => onAdjust(r)}
												className="rounded-full bg-blamejaOrange px-3 py-1.5 text-xs font-semibold text-white hover:bg-blamejaOrangeDark"
											>
												Корекција
											</button>

											<button
												type="button"
												onClick={() => onDelete(r)}
												aria-label="Избриши производ"
												className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
											>
												<FiTrash2 className="h-4 w-4" />
											</button>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}