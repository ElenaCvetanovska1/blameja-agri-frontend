'use client';

import { useEffect, useRef } from 'react';
import type { CartItem } from '../types';
import { clampFinalToBase, discountPercentFromBaseFinal, discountPerUnitFromBaseFinal, num, priceNum, round2 } from '../utils';

type Props = {
	item: CartItem;
	busy: boolean;
	autoFocusQty?: boolean;
	onRemove: () => void;
	onQtyChange: (nextQty: number) => void;
	onFinalPriceChange: (raw: string) => void;
	onFinalPriceBlur: () => void;
};

export const CartItemCard = ({ item, busy, autoFocusQty, onRemove, onQtyChange, onFinalPriceChange, onFinalPriceBlur }: Props) => {
	const qtyRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!autoFocusQty) return;
		const el = qtyRef.current;
		if (!el) return;

		// ✅ focus + select whole value (so you can type immediately)
		el.focus();
		el.select();
		// for some browsers
		try {
			el.setSelectionRange(0, el.value.length);
		} catch {}
	}, [autoFocusQty]);

	const base = num(item.product.selling_price);
	const finalRaw = priceNum(item.finalPriceStr);
	const final = clampFinalToBase(finalRaw, base);

	const disc = discountPerUnitFromBaseFinal(base, final);
	const discPct = discountPercentFromBaseFinal(base, final);

	const lineTotal = round2(final * item.qty);

	return (
		<div className="rounded-xl border border-slate-200 p-2">
			{/* LINE 1: title + remove */}
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="text-sm font-semibold text-slate-800 truncate">{item.product.name}</div>
					<div className="text-[11px] text-slate-500 truncate">
						PLU: <span className="font-medium">{item.product.plu ?? '—'}</span>
						{item.product.barcode ? (
							<>
								{' '}
								• <span className="font-medium">{item.product.barcode}</span>
							</>
						) : null}
					</div>
				</div>

				<button
					type="button"
					onClick={onRemove}
					className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
					disabled={busy}
				>
					Отстрани
				</button>
			</div>

			{/* LINE 2 */}
			<div className="mt-2 grid grid-cols-[84px_1fr_96px] gap-2 items-end">
				{/* qty */}
				<div>
					<label className="block text-[11px] font-medium text-slate-600">Кол.</label>
					<input
						ref={qtyRef}
						type="number"
						min={1}
						value={item.qty}
						onChange={(e) => onQtyChange(Number(e.target.value) || 1)}
						className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none
              focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						disabled={busy}
					/>
				</div>

				{/* final price + info */}
				<div>
					<div className="flex items-end justify-between">
						<label className="block text-[11px] font-medium text-slate-600">Цена (внеси)</label>
						<div className="text-[11px] text-slate-500">
							Фиксна: <span className="font-semibold text-slate-700">{base.toFixed(2)}</span>
						</div>
						<div className="mt-1 text-[11px] text-slate-600">
							Попуст: <span className="font-semibold text-emerald-700">{disc.toFixed(2)}</span>{' '}
							<span className="text-slate-500">({discPct.toFixed(1)}%)</span>
						</div>
					</div>

					<input
						inputMode="decimal"
						value={item.finalPriceStr}
						onChange={(e) => onFinalPriceChange(e.target.value)}
						onBlur={onFinalPriceBlur}
						placeholder={base > 0 ? base.toFixed(2) : '0.00'}
						className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none
              focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						disabled={busy}
					/>
				</div>

				{/* line total */}
				<div className="text-right">
					<label className="block text-[11px] font-medium text-slate-600">Вкупно</label>
					<div className="mt-1 h-9 rounded-lg bg-slate-100 px-2 flex items-center justify-end text-sm font-semibold text-slate-800">
						{lineTotal.toFixed(2)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CartItemCard;
