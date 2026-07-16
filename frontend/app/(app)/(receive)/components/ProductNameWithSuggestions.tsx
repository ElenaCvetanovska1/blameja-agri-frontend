// components/ProductNameWithSuggestions.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useListNav } from 'app/lib/useListNav';
import type { ProductChoiceRow, Unit } from '../types';
import { num } from '../utils';

type Props = {
	value: string;
	onChange: (v: string) => void;
	placeholder: string;
	loading: boolean;
	suggestions: ProductChoiceRow[];
	onPick: (row: ProductChoiceRow) => void;
	/** Enter без обележан предлог → точен lookup по PLU/баркод (како во Продажба). */
	onEnterCode?: (value: string) => void;
};

/* ─── Аватар со иницијали — идентичен како во Продажба ─── */
function ProductInitials({ name }: { name: string | null }) {
	const initials = (name ?? '?')
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? '')
		.join('');
	const hue = [...(name ?? '')].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
	return (
		<div
			className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
			style={{ background: `hsl(${hue},40%,42%)` }}
		>
			{initials || '?'}
		</div>
	);
}

export const ProductNameWithSuggestions = ({ value, onChange, placeholder, loading, suggestions, onPick, onEnterCode }: Props) => {
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

	const pick = (row: ProductChoiceRow) => {
		onPick(row);
		setOpen(false);
	};

	/* Тастатурна навигација низ предлозите (стрелки + Enter/Escape) */
	const { activeIndex, listRef, onInputKeyDown } = useListNav({
		itemCount: suggestions.length,
		isOpen: open && suggestions.length > 0,
		resetKey: value,
		onPick: (i) => {
			const row = suggestions[i];
			if (row) pick(row);
		},
		onClose: () => setOpen(false),
		onOpen: () => setOpen(true),
		// Enter без обележан предлог → точен lookup по шифра (никогаш не ја поднесува формата).
		onEnterNoSelection: () => {
			setOpen(false);
			if (value.trim()) onEnterCode?.(value);
		},
	});

	return (
		<div
			ref={wrapRef}
			className="relative space-y-2"
		>
			<label
				className="block text-sm font-medium"
				htmlFor="receive-product-name"
			>
				Име или PLU на производ <span className="text-blamejaRed">*</span>
			</label>

			<input
				id="receive-product-name"
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={onInputKeyDown}
				role="combobox"
				aria-expanded={show}
				aria-autocomplete="list"
				className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
				placeholder={placeholder}
			/>

			{show && (
				<div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
					<div
						ref={listRef}
						role="listbox"
						className="max-h-72 overflow-auto"
					>
						{loading && <div className="px-4 py-3 text-xs text-slate-500">Се пребарува...</div>}

						{!loading && suggestions.length === 0 && <div className="px-4 py-3 text-xs text-slate-500">Нема резултати.</div>}

						{suggestions.map((s, i) => {
							const cat = s.category_name ?? '—';
							const unit = (s.unit ?? 'пар') as Unit;

							return (
								<button
									key={s.product_id}
									type="button"
									role="option"
									aria-selected={i === activeIndex}
									data-nav-index={i}
									tabIndex={-1}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => pick(s)}
									className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${
										i === activeIndex ? 'bg-blamejaGreenSoft' : 'hover:bg-slate-50'
									}`}
								>
									<div className="flex items-center gap-3">
										<ProductInitials name={s.name ?? null} />
										<div className="flex-1 min-w-0">
											<div className="text-sm font-semibold text-slate-800 truncate">{s.name ?? '—'}</div>
											<div className="text-[11px] text-slate-500">
												PLU: <span className="font-medium text-slate-700">{s.plu ?? '—'}</span>
												{s.barcode ? (
													<>
														{' '}
														· <span className="font-medium text-slate-700">{s.barcode}</span>
													</>
												) : null}
											</div>
										</div>
										<div className="shrink-0 text-right">
											<div className="text-sm font-bold text-slate-900 tabular-nums">{num(s.selling_price).toFixed(2)} ден.</div>
											<div className="text-[11px] text-slate-500 truncate">
												{cat} · {unit}
											</div>
										</div>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			)}

			<p className="text-[11px] text-slate-500">
				Ако избереш постоечки производ, системот ќе пополни PLU/баркод/цена/ДДВ/Ед. мера. Ако внесуваш нов производ: внеси име и PLU.
			</p>
		</div>
	);
};

export default ProductNameWithSuggestions;
