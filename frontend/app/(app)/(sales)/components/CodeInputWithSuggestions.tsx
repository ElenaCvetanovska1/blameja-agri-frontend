'use client';

import { useRef } from 'react';
import type { ProductStockRow } from '../types';
import { num, safeText } from '../utils';

type Props = {
	value: string;
	onChange: (v: string) => void;
	onEnter: () => void;
	busy: boolean;

	wrapRef: React.RefObject<HTMLDivElement | null>;

	suggestions: ProductStockRow[];
	suggestOpen: boolean;
	suggestLoading: boolean;
	onOpenIfHasSuggestions: () => void;
	onCloseSuggestions: () => void;

	onPickSuggestion: (row: ProductStockRow) => void;
	onOpenScanner?: () => void;

	// ✅ NEW
	storeNo: 20 | 30;
	onStoreNoChange: (v: 20 | 30) => void;
};

export const CodeInputWithSuggestions = (props: Props) => {
	const {
		value,
		onChange,
		onEnter,
		busy,
		wrapRef,
		suggestions,
		suggestOpen,
		suggestLoading,
		onOpenIfHasSuggestions,
		onCloseSuggestions,
		onPickSuggestion,
		onOpenScanner,
		storeNo,
		onStoreNoChange,
	} = props;

	const inputRef = useRef<HTMLInputElement | null>(null);

	return (
		<div ref={wrapRef} className="relative">
			{/* ✅ во истиот rectangle, над пребарување */}
			<div className="mb-2 flex items-center justify-between gap-3">
				<label className="block text-xs font-medium text-slate-600">Баркод или PLU (или име)</label>

				<div className="flex items-center gap-2">
					<span className="text-[11px] text-slate-500">продавница бр</span>
					<select
						value={storeNo}
						onChange={(e) => onStoreNoChange(Number(e.target.value) as 20 | 30)}
						className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 bg-white"
						disabled={busy}
					>
						<option value={20}>20</option>
						<option value={30}>30</option>
					</select>
				</div>
			</div>

			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => onOpenScanner?.()}
					className="flex items-center justify-center rounded-lg bg-blamejaGreen px-3 py-2 text-sm font-semibold text-white hover:bg-blamejaGreenDark disabled:opacity-60"
					disabled={busy}
					aria-label="Скенирај"
				>
					Скенирај
				</button>

				<input
					ref={inputRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onFocus={() => onOpenIfHasSuggestions()}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							onEnter();
						}
						if (e.key === 'Escape') onCloseSuggestions();
					}}
					placeholder="Скенирај или почни да куцаш…"
					className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
				/>

				<button
					type="button"
					onClick={onEnter}
					disabled={busy}
					className="rounded-lg bg-blamejaOrange px-4 py-2 text-sm font-semibold text-white hover:bg-blamejaOrangeDark disabled:opacity-60"
				>
					{busy ? '...' : 'Додај'}
				</button>
			</div>

			{(suggestOpen || suggestLoading) && (
				<div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
					<div className="max-h-64 overflow-auto">
						{suggestLoading && <div className="px-3 py-2 text-xs text-slate-500">Се пребарува...</div>}

						{!suggestLoading && suggestions.length === 0 && (
							<div className="px-3 py-2 text-xs text-slate-500">Нема резултати.</div>
						)}

						{suggestions.map((s) => {
							const title = safeText(s.name) || '—';
							const pluText = s.plu != null ? String(s.plu) : '—';
							const barcodeText = s.barcode ?? '—';
							const qtyOnHand = num(s.qty_on_hand);
							const price = num(s.selling_price);
							const priceText = price > 0 ? price.toFixed(2) : '—';

							return (
								<button
									key={s.product_id}
									type="button"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										onPickSuggestion(s);
										inputRef.current?.focus();
									}}
									className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="text-sm font-semibold text-slate-800 truncate">{title}</div>
											<div className="text-[11px] text-slate-500">
												PLU: <span className="font-medium">{pluText}</span> • Баркод:{' '}
												<span className="font-medium">{barcodeText}</span>
											</div>
										</div>

										<div className="shrink-0 text-right">
											<div className="flex items-center gap-6">
												<div>
													<div className="text-[11px] text-slate-500">Цена</div>
													<div className="text-sm font-bold text-slate-900 tabular-nums">{priceText}</div>
												</div>

												<div>
													<div className="text-[11px] text-slate-500">Залиха</div>
													<div className="text-sm font-bold text-slate-900 tabular-nums">{qtyOnHand}</div>
												</div>
											</div>
										</div>
									</div>
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};

export default CodeInputWithSuggestions;