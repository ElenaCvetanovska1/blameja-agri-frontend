'use client';

import { useEffect, useRef, useState } from 'react';
import { FiRotateCcw, FiSearch } from 'react-icons/fi';
import { useListNav } from 'app/lib/useListNav';
import { CartItemCard } from '../../(sales)/components/CartItemCard';
import { useCart } from '../../(sales)/hooks/useCart';
import { useManualStorno } from '../../(sales)/hooks/useManualStorno';
import { useProductSearch } from '../../(sales)/hooks/useProductSearch';
import type { ProductStockRow } from '../../(sales)/types';
import { num } from '../../(sales)/utils';

const money = (n: number) => `${n.toFixed(2)} ден.`;

type Props = {
	/** Повикано по успешно сторно — за освежување на листата сметки. */
	onStornoDone: () => void;
};

/**
 * Рачно (ad-hoc) сторно — за оригинал што го НЕМА во базата.
 * Внеси ставки како за продажба (пребарување + кошничка), долу „Сторнирај".
 */
export const ManualStornoPanel = ({ onStornoDone }: Props) => {
	const [code, setCode] = useState('');
	const [storeNo, setStoreNo] = useState<20 | 30>(20);
	const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
	const [busy, setBusy] = useState(false);
	const [confirm, setConfirm] = useState(false);

	const { cart, totals, resetCart, removeItem, changeQty, addToCartFromRow, patchFinalPrice, clampFinalPriceOnBlur } = useCart();
	const { suggestions, suggestOpen, setSuggestOpen, suggestLoading } = useProductSearch(code, storeNo);
	const { runManualStorno } = useManualStorno();

	const cartEmpty = cart.length === 0;

	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const stornoBtnRef = useRef<HTMLButtonElement | null>(null);
	const cancelConfirmBtnRef = useRef<HTMLButtonElement | null>(null);

	const addProduct = async (row: ProductStockRow) => {
		await addToCartFromRow(row);
		setCode('');
		setSuggestOpen(false);
		searchInputRef.current?.focus();
	};

	/* Тастатурна навигација низ предлозите (стрелки + Enter/Escape) */
	const {
		activeIndex,
		listRef,
		onInputKeyDown,
	} = useListNav({
		itemCount: suggestions.length,
		isOpen: suggestOpen && suggestions.length > 0,
		resetKey: code,
		onPick: (i) => {
			const row = suggestions[i];
			if (row) void addProduct(row);
		},
		onClose: () => setSuggestOpen(false),
		// Enter без обележан предлог → земи го првиот резултат.
		onEnterNoSelection: () => {
			if (suggestions.length > 0) void addProduct(suggestions[0]);
		},
		onEscapeClosed: () => setCode(''),
	});

	/* Потврда: фокус на „Откажи" (безбедно), Escape ја откажува. */
	useEffect(() => {
		if (!confirm) return;
		cancelConfirmBtnRef.current?.focus();
		const handler = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			setConfirm(false);
			requestAnimationFrame(() => stornoBtnRef.current?.focus());
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [confirm]);

	const doStorno = async () => {
		setConfirm(false);
		setBusy(true);
		try {
			const ok = await runManualStorno({ cart, totals, paymentMethod });
			if (ok) {
				resetCart();
				onStornoDone();
			}
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
			{/* Header */}
			<div className="shrink-0 border-b border-slate-100 p-4">
				<div className="flex items-center gap-2">
					<FiRotateCcw className="h-4 w-4 text-red-600" />
					<div className="text-sm font-semibold text-slate-900">Рачно сторно</div>
				</div>
				<p className="mt-0.5 text-xs text-slate-500">За сметка што ја нема во базата (рачно испечатена). Внеси ги ставките и сторнирај.</p>

				{/* Store + search */}
				<div className="mt-3 flex gap-2">
					<select
						value={storeNo}
						onChange={(e) => setStoreNo(Number(e.target.value) as 20 | 30)}
						className="rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30"
					>
						<option value={20}>Прод. 20</option>
						<option value={30}>Прод. 30</option>
					</select>
					<div className="relative flex-1">
						<FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							ref={searchInputRef}
							value={code}
							onChange={(e) => setCode(e.target.value)}
							onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
							onKeyDown={onInputKeyDown}
							role="combobox"
							aria-expanded={suggestOpen && suggestions.length > 0}
							aria-autocomplete="list"
							placeholder="Пребарај производ (име / PLU / баркод)…"
							className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30"
						/>
						{suggestOpen && suggestions.length > 0 && (
							<div
								ref={listRef}
								role="listbox"
								className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
							>
								{suggestions.map((row, i) => (
									<button
										type="button"
										key={row.product_id}
										role="option"
										aria-selected={i === activeIndex}
										data-nav-index={i}
										tabIndex={-1}
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => void addProduct(row)}
										className={`flex w-full items-center justify-between gap-3 border-b border-slate-50 px-3 py-2 text-left last:border-0 ${
											i === activeIndex ? 'bg-blamejaGreenSoft' : 'hover:bg-slate-50'
										}`}
									>
										<div className="min-w-0">
											<div className="truncate text-sm font-medium text-slate-900">{row.name ?? '—'}</div>
											<div className="text-[11px] text-slate-500">
												PLU {row.plu ?? '—'} · залиха {num(row.qty_on_hand)}
											</div>
										</div>
										<div className="shrink-0 text-sm font-semibold text-slate-700">{money(num(row.selling_price))}</div>
									</button>
								))}
							</div>
						)}
						{suggestLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">…</div>}
					</div>
				</div>
			</div>

			{/* Cart items — scroll */}
			<div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
				{cartEmpty ? (
					<div className="flex h-full items-center justify-center text-center text-xs text-slate-400">
						Додај ставки за сторно преку пребарувањето погоре.
					</div>
				) : (
					cart.map((item) => (
						<CartItemCard
							key={item.product.id}
							item={item}
							busy={busy}
							onRemove={() => removeItem(item.product.id)}
							onQtyChange={(q) => changeQty(item.product.id, q)}
							onFinalPriceChange={(raw) => patchFinalPrice(item.product.id, raw)}
							onFinalPriceBlur={() => clampFinalPriceOnBlur(item.product.id)}
							onLineDone={() => searchInputRef.current?.focus()}
						/>
					))
				)}
			</div>

			{/* Footer — payment + total + storno */}
			<div className="shrink-0 space-y-3 border-t border-slate-100 p-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex gap-1 rounded-lg bg-slate-100 p-1">
						<button
							type="button"
							onClick={() => setPaymentMethod('CASH')}
							className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${paymentMethod === 'CASH' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
						>
							Готово
						</button>
						<button
							type="button"
							onClick={() => setPaymentMethod('CARD')}
							className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${paymentMethod === 'CARD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
						>
							Картичка
						</button>
					</div>
					<div className="text-right">
						<div className="text-[11px] text-slate-500">Вкупно за сторно</div>
						<div className="text-lg font-bold text-slate-900">{money(totals.total)}</div>
					</div>
				</div>

				{!confirm ? (
					<button
						type="button"
						ref={stornoBtnRef}
						onClick={() => setConfirm(true)}
						disabled={busy || cartEmpty}
						className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FiRotateCcw className="h-4 w-4" />
						Сторнирај (void сметка)
					</button>
				) : (
					<div className="rounded-xl border border-red-200 bg-red-50 p-3">
						<div className="mb-2 text-xs font-semibold text-red-700">
							Печати СТОРНО (поврат) сметка за {cart.length} ставки — {money(totals.total)}?
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								disabled={busy}
								onClick={() => void doStorno()}
								className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
							>
								{busy ? 'Обработка...' : 'Потврди сторно'}
							</button>
							<button
								type="button"
								ref={cancelConfirmBtnRef}
								onClick={() => {
									setConfirm(false);
									requestAnimationFrame(() => stornoBtnRef.current?.focus());
								}}
								className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
							>
								Откажи
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
