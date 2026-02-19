'use client';

import type { CartItem } from '../types';
import { clampPercent, clampPrice, percentNum, priceNum, round2, sanitizePriceInput } from '../utils';

type Props = {
	item: CartItem;
	busy: boolean;
	onRemove: () => void;
	onQtyChange: (nextQty: number) => void;
	onPatch: (patch: Partial<CartItem>) => void;
};

export const CartItemCard = ({ item, busy, onRemove, onQtyChange, onPatch }: Props) => {
	const price = priceNum(item.priceStr);
	const discountPerUnit = price * (percentNum(item.discountPercentStr) / 100);
	const finalUnit = price - discountPerUnit;
	const lineTotal = round2(finalUnit * item.qty);

	return (
		<div className="rounded-xl border border-slate-200 p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="font-semibold text-slate-800 truncate">{item.product.name}</div>
					<div className="text-xs text-slate-500">
						PLU: <span className="font-medium">{item.product.plu ?? '—'}</span>
						{item.product.barcode ? (
							<>
								{' '}
								• Баркод: <span className="font-medium">{item.product.barcode}</span>
							</>
						) : null}
					</div>
				</div>

				<button
					type="button"
					onClick={onRemove}
					className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
					disabled={busy}
				>
					Отстрани
				</button>
			</div>

			<div className="mt-3 flex items-end justify-between gap-3">
				<div className="flex-1">
					<label className="block text-xs font-medium text-slate-600">Количина</label>
					<div className="mt-1 flex items-center gap-2">
						<input
							type="number"
							min={1}
							value={item.qty}
							onChange={(e) => onQtyChange(Number(e.target.value) || 1)}
							className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                         focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						/>

						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => onQtyChange(item.qty - 1)}
								className="h-10 w-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
								disabled={busy || item.qty <= 1}
								aria-label="Намали количина"
							>
								−
							</button>
							<button
								type="button"
								onClick={() => onQtyChange(item.qty + 1)}
								className="h-10 w-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
								disabled={busy}
								aria-label="Зголеми количина"
							>
								+
							</button>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
				<div className="space-y-1">
					<label className="block text-xs font-medium text-slate-600">Цена</label>
					<input
						inputMode="decimal"
						value={item.priceStr}
						onChange={(e) => onPatch({ priceStr: sanitizePriceInput(e.target.value) })}
						onBlur={() => onPatch({ priceStr: clampPrice(item.priceStr) })}
						placeholder="цена"
						className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                       focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
					/>
				</div>

				<div className="space-y-1">
					<label className="block text-xs font-medium text-slate-600">Попуст %</label>
					<input
						inputMode="numeric"
						pattern="[0-9]*"
						value={item.discountPercentStr}
						onChange={(e) => onPatch({ discountPercentStr: e.target.value.replace(/[^\d]/g, '') })}
						onBlur={() => onPatch({ discountPercentStr: clampPercent(item.discountPercentStr) })}
						placeholder="попуст"
						className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                       focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
					/>
				</div>

				<div className="space-y-1">
					<label className="block text-xs font-medium text-slate-600">Вкупно</label>
					<div className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">{lineTotal.toFixed(2)}</div>
				</div>
			</div>
		</div>
	);
};
