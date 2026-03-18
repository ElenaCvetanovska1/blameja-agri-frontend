// components/BuyerInputWithSuggestions.tsx
'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { BuyerRow } from '../types';

type Props = {
	value: string;
	onChange: (v: string) => void;
	onPick: (row: BuyerRow) => void;

	all: BuyerRow[];
	loading: boolean;

	placeholder?: string;
	label?: string;
	hint?: string;

	// optional: ако сакаш да го лимитираме UI-то (не data)
	maxVisible?: number;
};

export default function BuyerInputWithSuggestions({
	value,
	onChange,
	onPick,
	all,
	loading,
	placeholder = 'Купувач…',
	label = 'Купувач',
	maxVisible = 5000, // ✅ UI friendly (не е data limit)
}: Props) {
	const id = useId();
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [open, setOpen] = useState(false);

	// close on outside click
	useEffect(() => {
		const handler = (e: PointerEvent) => {
			const root = wrapRef.current;
			if (!root) return;
			if (e.target instanceof Node && !root.contains(e.target)) setOpen(false);
		};

		document.addEventListener('pointerdown', handler, true);
		return () => document.removeEventListener('pointerdown', handler, true);
	}, []);

	// ✅ локално филтрирање
	const filtered = useMemo(() => {
		const term = value.trim().toLowerCase();
		if (!term) return all;

		return all.filter((b) => {
			const name = (b.name ?? '').toLowerCase();
			const addr = (b.address ?? '').toLowerCase();
			return name.includes(term) || addr.includes(term);
		});
	}, [all, value]);

	// ✅ за dropdown да не рендерира илјадници items одеднаш (само UI)
	const visible = useMemo(() => filtered.slice(0, maxVisible), [filtered, maxVisible]);

	const footerText = useMemo(() => {
		if (loading) return 'Се вчитува...';
		return `Прикажани ${Math.min(filtered.length, maxVisible)} од ${all.length}`;
	}, [loading, filtered.length, all.length, maxVisible]);

	return (
		<div
			ref={wrapRef}
			className="relative"
		>
			<label
				htmlFor={id}
				className="mb-1 block text-[11px] font-semibold text-slate-600"
			>
				{label}
			</label>

			<div className="relative">
				<input
					ref={inputRef}
					id={id}
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onClick={() => setOpen(true)}
					onKeyDown={(e) => {
						if (e.key === 'Escape') setOpen(false);
					}}
					className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm
            focus:border-blamejaGreen focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30"
					placeholder={placeholder}
					autoComplete="off"
				/>

				{/* стрелка */}
				<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
			</div>

			{open && (
				<div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
					<div className="max-h-72 overflow-auto">
						{loading && <div className="px-3 py-2 text-xs text-slate-500">Се вчитува…</div>}

						{!loading && all.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Нема купувачи.</div>}

						{!loading && all.length > 0 && filtered.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Нема резултати.</div>}

						{!loading &&
							visible.map((s) => (
								<button
									key={s.key}
									type="button"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										onPick(s);
										setOpen(false);
										inputRef.current?.focus();
									}}
									className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0"
								>
									<div className="min-w-0">
										<div className="truncate text-sm font-semibold text-slate-900">{s.name}</div>
										<div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
											{s.source === 'PERSON' ? 'Физичко лице' : 'Правно лице'}
											{s.address ? ` • ${s.address}` : ''}
										</div>
									</div>
								</button>
							))}

						{/* ако има повеќе од maxVisible, кажи дека е скратено само UI */}
						{!loading && filtered.length > maxVisible && (
							<div className="px-3 py-2 text-[11px] text-slate-500 bg-slate-50">
								Прикажувам први {maxVisible}. Почни да куцаш за да се стесни листата.
							</div>
						)}
					</div>

					<div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2">
						<span className="text-[10px] text-slate-500">{footerText}</span>
						<span className="text-[10px] text-slate-500">Esc</span>
					</div>
				</div>
			)}
		</div>
	);
}
