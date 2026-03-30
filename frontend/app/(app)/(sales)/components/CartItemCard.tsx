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

		el.focus();
		el.select();

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
		<div className="rounded-xl border border-slate-200 p-3 bg-white">
			{/* LINE 1: title + remove */}
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="truncate text-sm font-semibold text-slate-800">{item.product.name}</div>
					<div className="truncate text-[11px] text-slate-500">
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
			<div className="mt-3 grid grid-cols-[84px_1fr_110px] gap-3 items-end">
				{/* qty */}
				<div>
					<label
						className="block text-[11px] font-medium text-slate-600"
						htmlFor={`cart-qty-${item.product.id}`}
					>
						Кол.
					</label>
					<input
						id={`cart-qty-${item.product.id}`}
						ref={qtyRef}
						type="number"
						min={1}
						value={item.qty}
						onChange={(e) => onQtyChange(Number(e.target.value) || 1)}
						className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blamejaGreen focus:ring-2 focus:ring-blamejaGreen/30"
						disabled={busy}
					/>
				</div>

				{/* final price + fixed + discount */}
				<div>
					<div className="mb-1 flex items-center justify-between gap-3">
						<label
							className="block text-[11px] font-medium text-slate-600"
							htmlFor={`cart-price-${item.product.id}`}
						>
							Цена (внеси)
						</label>

						<div className="flex items-center gap-4 text-[11px]">
							<div className="text-slate-500">
								Фиксна: <span className="font-semibold text-slate-700">{base.toFixed(2)}</span>
							</div>

							<div className="text-slate-500">
								Попуст:{' '}
								<span className={disc > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-700'}>{disc.toFixed(2)}</span>{' '}
								<span className={disc > 0 ? 'text-emerald-600/80' : 'text-slate-400'}>({discPct.toFixed(1)}%)</span>
							</div>
						</div>
					</div>

					<input
						id={`cart-price-${item.product.id}`}
						inputMode="decimal"
						value={item.finalPriceStr}
						onChange={(e) => onFinalPriceChange(e.target.value)}
						onBlur={onFinalPriceBlur}
						placeholder={base > 0 ? base.toFixed(2) : '0.00'}
						className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blamejaGreen focus:ring-2 focus:ring-blamejaGreen/30"
						disabled={busy}
					/>
				</div>

				{/* line total */}
				<div className="text-right">
					<span className="block text-[11px] font-medium text-slate-600">Вкупно</span>
					<div className="mt-1 flex h-10 items-center justify-end rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-800">
						{lineTotal.toFixed(2)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CartItemCard;
