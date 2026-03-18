'use client';

import { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import type { DispatchRowVM, ProductSuggestion } from '../types';
import { money, num } from '../utils';
import { useDispatchProductSearch } from '../hooks/useDispatchProductSearch';
import ProductAutocompleteInput from './ProductAutocompleteInput';

type Props = {
	rows: DispatchRowVM[];
	onUpdate: (id: string, patch: any) => void;
	onRemove: (id: string) => void;
};

export const DispatchTable = ({ rows, onUpdate, onRemove }: Props) => {
	const cellInputCls = 'w-full rounded-md border border-slate-200 px-2 py-1 text-sm';

	return (
		<div className="mt-3 rounded-xl border border-slate-200 overflow-x-auto overflow-y-auto max-h-[320px]">
			<table className="min-w-[980px] w-full border-collapse">
				<thead className="sticky top-0 bg-white z-10">
					<tr className="text-[11px] text-slate-600">
						<th className="text-left p-2 border-b border-slate-200 w-[60px]">Ред.</th>
						<th className="text-left p-2 border-b border-slate-200 w-[160px]">Шифра (PLU)</th>
						<th className="text-left p-2 border-b border-slate-200">Назив</th>
						<th className="text-left p-2 border-b border-slate-200 w-[120px]">Един. мер</th>
						<th className="text-right p-2 border-b border-slate-200 w-[120px]">Количина</th>
						<th className="text-right p-2 border-b border-slate-200 w-[120px]">Цена</th>
						<th className="text-right p-2 border-b border-slate-200 w-[140px]">Продажна цена</th>
						<th className="text-right p-2 border-b border-slate-200 w-[140px]">Износ</th>
						<th className="p-2 border-b border-slate-200 w-[80px]" />
					</tr>
				</thead>

				<tbody>
					{rows.map((r) => (
						<DispatchRow
							key={r.id}
							r={r}
							cellInputCls={cellInputCls}
							onUpdate={onUpdate}
							onRemove={onRemove}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
};

const DispatchRow = ({
	r,
	cellInputCls,
	onUpdate,
	onRemove,
}: {
	r: DispatchRowVM;
	cellInputCls: string;
	onUpdate: (id: string, patch: any) => void;
	onRemove: (id: string) => void;
}) => {
	const [sifraOpen, setSifraOpen] = useState(false);
	const sifraSearch = useDispatchProductSearch({ term: r.sifra, limit: 8 });

	const [nazivOpen, setNazivOpen] = useState(false);
	const nazivSearch = useDispatchProductSearch({ term: r.naziv, limit: 8 });

	const applySuggestion = (s: ProductSuggestion) => {
		const fixed = Number.isFinite(s.selling_price) ? s.selling_price : 0;

		onUpdate(r.id, {
			productId: s.id, // required for DB inserts
			sifra: s.plu ? s.plu : '',
			barcode: s.barcode ?? null,

			naziv: s.name ?? '',
			edinMer: s.unit ?? 'пар',

			cena: fixed,
			prodaznaCena: fixed,
		});
	};

	return (
		<tr className="text-sm">
			<td className="p-2 border-b border-slate-100">{r.rb}</td>

			<td className="p-2 border-b border-slate-100">
				<ProductAutocompleteInput
					value={r.sifra}
					onChange={(v) => {
						onUpdate(r.id, { sifra: v });
						setSifraOpen(v.trim().length > 0);
					}}
					placeholder="PLU..."
					suggestions={sifraSearch.suggestions}
					open={sifraOpen && (sifraSearch.open || sifraSearch.loading)}
					setOpen={setSifraOpen}
					loading={sifraSearch.loading}
					onPick={applySuggestion}
				/>
			</td>

			<td className="p-2 border-b border-slate-100">
				<ProductAutocompleteInput
					value={r.naziv}
					onChange={(v) => {
						onUpdate(r.id, { naziv: v });
						setNazivOpen(v.trim().length > 0);
					}}
					placeholder="Почни да куцаш…"
					suggestions={nazivSearch.suggestions}
					open={nazivOpen && (nazivSearch.open || nazivSearch.loading)}
					setOpen={setNazivOpen}
					loading={nazivSearch.loading}
					onPick={applySuggestion}
				/>
			</td>

			<td className="p-2 border-b border-slate-100">
				<select
					className={cellInputCls}
					value={r.edinMer || ''}
					onChange={(e) => onUpdate(r.id, { edinMer: e.target.value })}
				>
					<option value="">—</option>
					<option value="пар">пар</option>
					<option value="кг">кг</option>
					<option value="м">м</option>
				</select>
			</td>

			<td className="p-2 border-b border-slate-100 text-right">
				<input
					inputMode="decimal"
					className={`${cellInputCls} text-right`}
					value={String(r.kolicina)}
					onChange={(e) => onUpdate(r.id, { kolicina: num(e.target.value) })}
				/>
			</td>

			<td className="p-2 border-b border-slate-100 text-right">
				<input
					readOnly
					tabIndex={-1}
					className={`${cellInputCls} text-right bg-slate-50 text-slate-700`}
					value={r.cena ? String(r.cena) : ''}
					placeholder="0.00"
				/>
			</td>

			<td className="p-2 border-b border-slate-100 text-right">
				<input
					inputMode="decimal"
					placeholder="0.00"
					className={`${cellInputCls} text-right`}
					value={r.prodaznaCena ? String(r.prodaznaCena) : ''}
					onChange={(e) => onUpdate(r.id, { prodaznaCena: num(e.target.value) })}
				/>
			</td>

			<td className="p-2 border-b border-slate-100 text-right font-semibold">{money(r.iznos)}</td>

			<td className="p-2 border-b border-slate-100 text-right">
				<button
					type="button"
					onClick={() => onRemove(r.id)}
					aria-label="Избриши ред"
					className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition"
				>
					<FiTrash2 className="h-4 w-4" />
				</button>
			</td>
		</tr>
	);
};

export default DispatchTable;
