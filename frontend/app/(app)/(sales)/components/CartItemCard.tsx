'use client';

import { useEffect, useRef, useState } from 'react';
import type { CartItem } from '../types';
import { discountPercentFromBaseFinal, discountPerUnitFromBaseFinal, num, priceNum, round2 } from '../utils';

type Props = {
	item: CartItem;
	busy: boolean;
	autoFocusQty?: boolean;
	onRemove: () => void;
	onQtyChange: (nextQty: number) => void;
	onFinalPriceChange: (raw: string) => void;
	onFinalPriceBlur: () => void;
	/** Enter/Escape во „Кол."/„Цена" → готово со линијата (обично: врати фокус на пребарување). */
	onLineDone?: () => void;
};

export const CartItemCard = ({ item, busy, autoFocusQty, onRemove, onQtyChange, onFinalPriceChange, onFinalPriceBlur, onLineDone }: Props) => {
	const qtyRef = useRef<HTMLInputElement | null>(null);

	// Локален string за количината → дозволува пишување децимали (пр. "1.6") без да „снапнува" точката.
	const [qtyStr, setQtyStr] = useState(String(item.qty));
	useEffect(() => {
		// Ресинхронизирај само кога qty се менува ОДВОР (пр. повторно додавање) — не додека куцаш децимала.
		setQtyStr((prev) => (Number(prev.replace(',', '.')) === item.qty ? prev : String(item.qty)));
	}, [item.qty]);

	const onQtyInput = (raw: string) => {
		setQtyStr(raw);
		const parsed = Number(raw.replace(',', '.'));
		if (Number.isFinite(parsed) && parsed > 0) onQtyChange(parsed);
	};

	const onQtyBlur = () => {
		const parsed = Number(qtyStr.replace(',', '.'));
		if (!Number.isFinite(parsed) || parsed <= 0) {
			setQtyStr(String(item.qty)); // врати валидна вредност ако полето е празно/невалидно
		} else {
			setQtyStr(String(Math.round(parsed * 1000) / 1000));
		}
	};

	// Навигација меѓу ставки во кошничката преку „Кол." полињата (↑/↓).
	// Враќа true ако имало соседна ставка во дадениот правец.
	const focusSibling = (dir: 1 | -1): boolean => {
		const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-cart-qty]'));
		const idx = inputs.findIndex((el) => el === qtyRef.current);
		if (idx === -1) return false;
		const next = inputs[idx + dir];
		if (!next) return false;
		next.focus();
		next.select();
		return true;
	};

	const qtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		// ↑/↓ → движење по ставки (претходна/следна).
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			focusSibling(1);
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			focusSibling(-1);
			return;
		}
		// Delete → избриши ја оваа ставка; фокусот оди на следна (или претходна, или пребарување).
		if (e.key === 'Delete') {
			e.preventDefault();
			if (!focusSibling(1) && !focusSibling(-1)) onLineDone?.();
			onRemove();
			return;
		}
		// Enter/Escape → готово со линијата (назад на пребарување).
		if (e.key === 'Enter' || e.key === 'Escape') {
			e.preventDefault();
			e.currentTarget.blur(); // blur ги нормализира/клампа вредностите
			onLineDone?.();
		}
	};

	const fieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' || e.key === 'Escape') {
			e.preventDefault();
			e.currentTarget.blur(); // blur ги нормализира/клампа вредностите
			onLineDone?.();
		}
	};

	useEffect(() => {
		if (!autoFocusQty) return;
		const el = qtyRef.current;
		if (!el) return;

		// rAF — фокус/селекција откако вредноста ќе се стабилизира (пр. 1 → 2 при повторно додавање).
		const raf = requestAnimationFrame(() => {
			el.focus();
			el.select();

			try {
				el.setSelectionRange(0, el.value.length);
			} catch {}
		});
		return () => cancelAnimationFrame(raf);
	}, [autoFocusQty]);

	const base = num(item.product.selling_price);
	// Дозволена е и повисока цена од основната — попустот тогаш е 0 (никогаш не оди во минус).
	const final = priceNum(item.finalPriceStr);

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
						data-cart-qty
						ref={qtyRef}
						type="text"
						inputMode="decimal"
						value={qtyStr}
						onChange={(e) => onQtyInput(e.target.value)}
						onBlur={onQtyBlur}
						onKeyDown={qtyKeyDown}
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
						onKeyDown={fieldKeyDown}
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
