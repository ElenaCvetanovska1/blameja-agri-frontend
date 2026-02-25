// components/ProductNameWithSuggestions.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProductChoiceRow, Unit } from '../types';
import { num } from '../utils';

type Props = {
	value: string;
	onChange: (v: string) => void;
	placeholder: string;
	loading: boolean;
	suggestions: ProductChoiceRow[]; // normalized by caller
	onPick: (row: ProductChoiceRow) => void;
};

export const ProductNameWithSuggestions = ({ value, onChange, placeholder, loading, suggestions, onPick }: Props) => {
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onDown = (e: MouseEvent) => {
			const el = wrapRef.current;
			if (!el) return;
			if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
		};
		document.addEventListener('mousedown', onDown);
		return () => document.removeEventListener('mousedown', onDown);
	}, []);

	const show = open && (loading || suggestions.length > 0);

	return (
		<div
			ref={wrapRef}
			className="relative space-y-2"
		>
			<label className="block text-sm font-medium">
				Име на производ <span className="text-blamejaRed">*</span>
			</label>

			<input
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={(e) => {
					if (e.key === 'Escape') setOpen(false);
				}}
				className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
				placeholder={placeholder}
			/>

			{show && (
				<div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
					<div className="max-h-64 overflow-auto">
						{loading && <div className="px-3 py-2 text-xs text-slate-500">Се пребарува...</div>}

						{!loading && suggestions.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Нема резултати.</div>}

						{suggestions.map((s) => {
							const title = (s.name ?? '—').trim();
							const pluText = s.plu ?? '—';
							const barcodeText = s.barcode ?? '—';
							const cat = s.category_name ?? '—';
							const unit = (s.unit ?? 'пар') as Unit;

							return (
								<button
									key={s.product_id}
									type="button"
									onClick={() => {
										onPick(s);
										setOpen(false);
									}}
									className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="text-sm font-semibold text-slate-800 truncate">{title}</div>
											<div className="text-[11px] text-slate-500">
												PLU: <span className="font-medium">{pluText}</span> • Баркод: <span className="font-medium">{barcodeText}</span>
											</div>
											<div className="text-[11px] text-slate-500 truncate">
												{cat} • {unit}
											</div>
										</div>

										<div className="shrink-0 text-right">
											<div className="text-[11px] text-slate-500">Цена</div>
											<div className="text-sm font-bold text-slate-900">{num(s.selling_price).toFixed(2)}</div>
										</div>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			)}

			<p className="text-[11px] text-slate-500">
				Ако избереш постоечки производ, системот ќе пополни PLU/баркод/цена/ДДВ/Ед. мера. Ако внесуваш нов производ: избери категорија,
				внеси име и PLU.
			</p>
		</div>
	);
};

export default ProductNameWithSuggestions;
