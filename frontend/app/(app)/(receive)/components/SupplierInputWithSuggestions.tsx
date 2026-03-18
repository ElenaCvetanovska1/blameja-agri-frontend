'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SupplierRow } from '../hooks/useSupplierChoices';

type Props = {
	value: string;
	onChange: (v: string) => void;
	onPick: (row: SupplierRow) => void;

	suggestions: SupplierRow[];
	loading: boolean;

	openAll: boolean;
	onOpenAll: () => void;
	onCloseAll: () => void;

	placeholder?: string;
	label?: string;
	hint?: string;
};

export const SupplierInputWithSuggestions = ({
	value,
	onChange,
	onPick,
	suggestions,
	loading,
	openAll,
	onOpenAll,
	onCloseAll,
	placeholder = 'Кликни за листа или почни да куцаш…',
	label = 'Добавувач',
	hint,
}: Props) => {
	const id = useId();
	const wrapRef = useRef<HTMLDivElement | null>(null);

	const [open, setOpen] = useState(false);

	// ✅ click outside (најсигурно: pointerdown + capture)
	useEffect(() => {
		const handler = (e: PointerEvent) => {
			const root = wrapRef.current;
			if (!root) return;

			if (e.target instanceof Node && !root.contains(e.target)) {
				setOpen(false);
				onCloseAll(); // важно: да не остане openAll=true
			}
		};

		document.addEventListener('pointerdown', handler, true);
		return () => document.removeEventListener('pointerdown', handler, true);
	}, [onCloseAll]);

	const footerText = useMemo(() => {
		if (loading) return 'Се вчитува...';
		if (openAll) return `${suggestions.length} добавувачи (лист)`;
		return `${suggestions.length} резултати`;
	}, [loading, openAll, suggestions.length]);

	return (
		<div
			ref={wrapRef}
			className="relative"
		>
			<label
				htmlFor={id}
				className="mb-1 block text-sm font-medium text-slate-800"
			>
				{label}
			</label>

			<div className="relative">
				<input
					id={id}
					value={value}
					onChange={(e) => {
						const v = e.target.value;
						onChange(v);
						setOpen(true);

						if (!v.trim()) onOpenAll();
						else onCloseAll();
					}}
					onFocus={() => {
						setOpen(true);
						if (!value.trim()) onOpenAll();
					}}
					onClick={() => {
						setOpen(true);
						if (!value.trim()) onOpenAll();
					}}
					onKeyDown={(e) => {
						if (e.key === 'Escape') {
							setOpen(false);
							onCloseAll();
						}
					}}
					className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm
                     focus:border-blamejaGreen focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30"
					placeholder={placeholder}
					autoComplete="off"
				/>

				{/* само украс */}
				<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
			</div>

			{hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}

			{open && (
				<div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
					<div className="max-h-72 overflow-auto">
						{loading && <div className="px-3 py-2 text-xs text-slate-500">Се вчитува…</div>}

						{!loading && suggestions.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Нема резултати.</div>}

						{!loading &&
							suggestions.map((s) => (
								<button
									key={s.id}
									type="button"
									onClick={() => {
										onPick(s);
										setOpen(false);
										onCloseAll();
									}}
									className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0"
								>
									<div className="min-w-0">
										<div className="truncate text-sm font-semibold text-slate-900">{s.name}</div>
										{s.address ? (
											<div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{s.address}</div>
										) : (
											<div className="mt-0.5 text-[11px] text-slate-400">— без адреса</div>
										)}
									</div>
								</button>
							))}
					</div>

					<div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2">
						<span className="text-[10px] text-slate-500">{footerText}</span>
						<span className="text-[10px] text-slate-500">Esc</span>
					</div>
				</div>
			)}
		</div>
	);
};
