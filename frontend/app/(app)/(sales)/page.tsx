'use client';

import { useEffect, useRef, useState } from 'react';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';
import { api } from 'app/lib/api-client';
import { FiSearch, FiCamera, FiX, FiShoppingCart, FiClock, FiPlus, FiZap, FiRefreshCw } from 'react-icons/fi';
import { fiscalBridge } from 'app/lib/fiscal-bridge';

import type { ProductStockRow } from './types';
import { num } from './utils';
import { useOutsideClick } from './hooks/useOutsideClick';
import { useProductSearch } from './hooks/useProductSearch';
import { useCart } from './hooks/useCart';
import { useSalesSubmit } from './hooks/useSalesSubmit';
import { useFiscalSaleFlow } from './hooks/useFiscalSaleFlow';
import { useFiscalStatus } from './hooks/useFiscalStatus';
import { CartItemCard } from './components/CartItemCard';
import { ScannerModal } from './components/ScannerModal';
import { TotalsPanel } from './components/TotalsPanel';

/* ─── Quick / Recent Products (localStorage) ─── */
const RECENT_KEY = 'blameja_recent_products';
const MAX_RECENT = 12;

function loadRecentProducts(): ProductStockRow[] {
	try {
		const raw = localStorage.getItem(RECENT_KEY);
		return raw ? (JSON.parse(raw) as ProductStockRow[]) : [];
	} catch {
		return [];
	}
}

function saveRecentProduct(row: ProductStockRow) {
	try {
		const existing = loadRecentProducts();
		const filtered = existing.filter((r) => r.product_id !== row.product_id);
		localStorage.setItem(RECENT_KEY, JSON.stringify([row, ...filtered].slice(0, MAX_RECENT)));
	} catch {
		/* ignore */
	}
}

/* ─── API ─── */
const fetchProductByCode = async (code: string, storeNo: 20 | 30): Promise<ProductStockRow | null> => {
	const trimmed = code.trim();
	if (!trimmed) return null;
	return (
		(await api.get<ProductStockRow | null>(`/api/sales/products/lookup?code=${encodeURIComponent(trimmed)}&storeNo=${storeNo}`)) ?? null
	);
};

/* ─── Product color-initial avatar (no image needed) ─── */
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

/* ═══════════════════════════════════════
   SALES PAGE
═══════════════════════════════════════ */
const SalesPage = () => {
	const [code, setCode] = useState('');
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);
	const [scannerOpen, setScannerOpen] = useState(false);
	const [scanError, setScanError] = useState<string | null>(null);
	const [focusProductId, setFocusProductId] = useState<string | null>(null);
	const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
	const [cashReceivedStr, setCashReceivedStr] = useState('');
	const [storeNo, setStoreNo] = useState<20 | 30>(20);
	const [recentProducts, setRecentProducts] = useState<ProductStockRow[]>(loadRecentProducts);

	const wrapRef = useRef<HTMLDivElement | null>(null);
	const searchInputRef = useRef<HTMLInputElement | null>(null);

	const { cart, totals, resetCart, removeItem, changeQty, addToCartFromRow, patchFinalPrice, clampFinalPriceOnBlur } = useCart();
	const { submitSale } = useSalesSubmit();
	const { runFiscalSale } = useFiscalSaleFlow();
	const { status: fiscalStatus, warnings: fiscalWarnings, refresh: refreshFiscalStatus } = useFiscalStatus();
	const { suggestions, suggestOpen, setSuggestOpen, suggestLoading, setSuggestions } = useProductSearch(code, storeNo);

	useOutsideClick(wrapRef, () => setSuggestOpen(false));

	/* Global keyboard shortcuts */
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'F4') {
				e.preventDefault();
				searchInputRef.current?.focus();
				searchInputRef.current?.select();
			}
			if (e.key === 'F9') {
				e.preventDefault();
				void handleSubmitSale();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cart, totals, paymentMethod, cashReceivedStr]);

	const resetSale = () => {
		setCode('');
		setNote('');
		resetCart();
		setScanError(null);
		setSuggestions([]);
		setSuggestOpen(false);
		setFocusProductId(null);
		setPaymentMethod('CASH');
		setCashReceivedStr('');
	};

	const addProductToCart = async (row: ProductStockRow) => {
		if (num(row.qty_on_hand) <= 0) toast.warning(`Внимание: залиха ${num(row.qty_on_hand)}. Ќе дозволи продажба во минус.`);
		const addedId = await addToCartFromRow(row);
		if (addedId) setFocusProductId(addedId);
		saveRecentProduct(row);
		setRecentProducts(loadRecentProducts());
		return addedId;
	};

	const handleAddByCode = async (codeValue?: string) => {
		const value = (codeValue ?? code).trim();
		if (!value) {
			toast.error('Внеси баркод или PLU.');
			return;
		}
		setBusy(true);
		try {
			const row = await fetchProductByCode(value, storeNo);
			if (!row) {
				toast.error(`Не е пронајден производ во продавница ${storeNo}.`);
				return;
			}
			await addProductToCart(row);
			setCode('');
			setSuggestions([]);
			setSuggestOpen(false);
		} catch (e) {
			console.error(e);
			toast.error('Грешка при барање на производ.');
		} finally {
			setBusy(false);
		}
	};

	const handleSubmitSale = async () => {
		setBusy(true);
		try {
			const { receiptId } = await submitSale({ cart, totals, note, paymentMethod, cashReceivedStr, onSuccess: resetSale });

			// Fresh status check right before fiscal action
			try {
				const deviceStatus = await fiscalBridge.getStatus();
				refreshFiscalStatus(); // sync UI badge with the fresh result
				if (!deviceStatus.IsConnected) {
					toast.error('Продажбата е зачувана, но фискалната каса е офлајн — receipтот не е испечатен.');
					return;
				}
			} catch {
				refreshFiscalStatus();
				toast.error('Продажбата е зачувана, но FiscalBridge не е достапен — receipтот не е испечатен.');
				return;
			}

			void runFiscalSale({ receiptId, cart, totals, paymentMethod });
		} catch (e: unknown) {
			const msg = (e as Error)?.message ?? '';
			if (msg !== 'empty-cart' && msg !== 'insufficient-cash') {
				console.error(e);
				toast.error('Грешка при зачувување на продажбата.');
			}
		} finally {
			setBusy(false);
		}
	};

	const handleScan = (detected: IDetectedBarcode[]) => {
		if (!detected?.length) return;
		const raw = detected[0]?.rawValue ?? '';
		if (!raw) return;
		setScannerOpen(false);
		setScanError(null);
		setCode(raw);
		void handleAddByCode(raw);
	};

	/* ──────────────────────────────────────────────
	   LAYOUT: full height flex column
	   Top bar (shrink-0) + body (flex-1, overflow hidden)
	────────────────────────────────────────────── */
	return (
		<div className="flex flex-col h-full min-h-0 gap-3">
			{/* ── TOP: Search bar ── */}
			<div className="card px-4 py-3 shrink-0">
				<div className="flex items-center gap-3 flex-wrap">
					{/* Store */}
					<div className="flex items-center gap-2 shrink-0">
						<span className="text-xs font-semibold text-slate-500 hidden sm:block">Продавница</span>
						<select
							value={storeNo}
							onChange={(e) => {
								setStoreNo(Number(e.target.value) as 20 | 30);
								setCode('');
								setSuggestions([]);
								setSuggestOpen(false);
							}}
							className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm font-semibold text-slate-700"
							disabled={busy}
						>
							<option value={20}>Бр. 20</option>
							<option value={30}>Бр. 30</option>
						</select>
					</div>

					<div className="w-px h-6 bg-slate-200 hidden sm:block shrink-0" />

					{/* Search input */}
					<div
						ref={wrapRef}
						className="relative flex-1 min-w-[200px]"
					>
						<div className="flex items-center gap-2">
							<div className="relative flex-1">
								<FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
								<input
									ref={searchInputRef}
									id="sales-search"
									value={code}
									onChange={(e) => {
										setCode(e.target.value);
										setSuggestOpen(e.target.value.trim().length > 0);
										setFocusProductId(null);
									}}
									onFocus={() => {
										if (code.trim().length > 0) setSuggestOpen(true);
									}}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											void handleAddByCode();
										}
										if (e.key === 'Escape') setSuggestOpen(false);
									}}
									placeholder="Баркод, PLU или назив…"
									className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none
										focus:border-blamejaGreen focus:ring-2 focus:ring-blamejaGreen/20"
									disabled={busy}
								/>
							</div>

							<button
								type="button"
								onClick={() => void handleAddByCode()}
								disabled={busy || !code.trim()}
								className="h-10 px-4 rounded-xl bg-blamejaGreen text-white text-sm font-semibold
									hover:bg-blamejaGreenDark disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
							>
								<FiPlus className="w-4 h-4" />
								<span className="hidden sm:inline">Додај</span>
							</button>

							<button
								type="button"
								onClick={() => {
									setScanError(null);
									setScannerOpen(true);
								}}
								disabled={busy}
								className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
								title="Скенирај баркод"
							>
								<FiCamera className="w-4 h-4" />
							</button>
						</div>

						{/* Suggestions dropdown */}
						{(suggestOpen || suggestLoading) && (
							<div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
								<div className="max-h-72 overflow-auto">
									{suggestLoading && <div className="px-4 py-3 text-xs text-slate-500">Се пребарува...</div>}
									{!suggestLoading && suggestions.length === 0 && <div className="px-4 py-3 text-xs text-slate-500">Нема резултати.</div>}
									{suggestions.map((s) => (
										<button
											key={s.product_id}
											type="button"
											onMouseDown={(e) => e.preventDefault()}
											onClick={async () => {
												setSuggestOpen(false);
												await addProductToCart(s);
												setCode('');
												setSuggestions([]);
											}}
											className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
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
													<div className="text-[11px] text-slate-500">
														Зал:{' '}
														<span
															className={`font-semibold ${num(s.qty_on_hand) <= 0 ? 'text-red-600' : num(s.qty_on_hand) <= 3 ? 'text-amber-600' : 'text-emerald-700'}`}
														>
															{num(s.qty_on_hand)}
														</span>
													</div>
												</div>
											</div>
										</button>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Shortcut hints */}
					<div className="hidden lg:flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
						<span className="kbd">F4</span>
						<span>Пребарај</span>
						<span className="text-slate-300 mx-0.5">·</span>
						<span className="kbd">F9</span>
						<span>Зачувај</span>
					</div>

					{/* Fiscal device status badge + manual refresh */}
					<div className="hidden sm:flex items-center gap-1 shrink-0">
						<div
							className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border
							${
								fiscalStatus === 'online'
									? 'bg-emerald-50 border-emerald-200 text-emerald-700'
									: fiscalStatus === 'warning'
										? 'bg-amber-50  border-amber-200  text-amber-700'
										: fiscalStatus === 'offline'
											? 'bg-red-50    border-red-200    text-red-700'
											: 'bg-slate-50  border-slate-200  text-slate-500'
							}`}
						>
							<span
								className={`h-2 w-2 rounded-full
								${
									fiscalStatus === 'online'
										? 'bg-emerald-500'
										: fiscalStatus === 'warning'
											? 'bg-amber-500'
											: fiscalStatus === 'offline'
												? 'bg-red-500'
												: 'bg-slate-400 animate-pulse'
								}`}
							/>
							{fiscalStatus === 'online'
								? 'Фискална поврзана'
								: fiscalStatus === 'warning'
									? 'Фискална — предупредување'
									: fiscalStatus === 'offline'
										? 'Фискална офлајн'
										: 'Фискална проверка...'}
						</div>
						<button
							type="button"
							onClick={() => refreshFiscalStatus()}
							title="Провери статус на фискална каса"
							className="h-6 w-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
						>
							<FiRefreshCw className="w-3 h-3" />
						</button>
					</div>
				</div>
			</div>

			{/* ── BODY: left content + right cart (flex-1, no outer scroll) ── */}
			<div className="flex gap-3 flex-1 min-h-0">
				{/* ── LEFT: Quick products + cart items ── */}
				<div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
					{/* Quick products — shrink-0, fixed height */}
					<div className="card px-4 py-3 shrink-0">
						<div className="flex items-center justify-between mb-2.5">
							<div className="flex items-center gap-2">
								{recentProducts.length > 0 ? (
									<>
										<FiClock className="w-3.5 h-3.5 text-slate-400" />
										<span className="text-xs font-semibold text-slate-600">Последно користени</span>
									</>
								) : (
									<>
										<FiZap className="w-3.5 h-3.5 text-slate-400" />
										<span className="text-xs font-semibold text-slate-600">Брзи производи</span>
									</>
								)}
							</div>
							{recentProducts.length > 0 && (
								<button
									type="button"
									onClick={() => {
										localStorage.removeItem(RECENT_KEY);
										setRecentProducts([]);
									}}
									className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
								>
									Избриши историја
								</button>
							)}
						</div>

						{recentProducts.length === 0 ? (
							<div className="py-3 text-center text-xs text-slate-400">Производите кои ги додадете ќе се прикажат тука за брз пристап.</div>
						) : (
							<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
								{recentProducts.map((p) => {
									const qoh = num(p.qty_on_hand);
									const isZero = qoh <= 0;
									const isLow = qoh > 0 && qoh <= 3;
									return (
										<button
											key={p.product_id}
											type="button"
											disabled={busy}
											onClick={() => void addProductToCart(p)}
											className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center
												transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
												disabled:opacity-50 disabled:cursor-not-allowed
												${isZero ? 'border-red-100 bg-red-50/40' : isLow ? 'border-amber-100 bg-amber-50/40' : 'border-slate-100 bg-white hover:border-blamejaGreen/30'}`}
										>
											<ProductInitials name={p.name ?? null} />
											<div className="w-full min-w-0">
												<div className="text-[11px] font-semibold text-slate-800 truncate leading-tight">{p.name ?? '—'}</div>
												<div className="text-[10px] text-slate-500 tabular-nums">{num(p.selling_price).toFixed(2)} ден.</div>
											</div>
											<div
												className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${isZero ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'}`}
											/>
										</button>
									);
								})}
							</div>
						)}
					</div>

					{/* Cart items — flex-1, internal scroll */}
					<div className="card flex flex-col flex-1 min-h-0 overflow-hidden">
						{/* Cart header — shrink-0 */}
						<div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
							<div className="flex items-center gap-2">
								<FiShoppingCart className="w-4 h-4 text-slate-400" />
								<span className="text-sm font-semibold text-slate-700">
									Кошничка
									{cart.length > 0 && (
										<span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-blamejaGreen text-white text-[10px] font-bold">
											{cart.length}
										</span>
									)}
								</span>
							</div>
							{cart.length > 0 && (
								<button
									type="button"
									onClick={resetSale}
									disabled={busy}
									className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
								>
									<FiX className="w-3.5 h-3.5" />
									Исчисти
								</button>
							)}
						</div>

						{/* Cart items — scrollable */}
						<div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
							{cart.length === 0 ? (
								<div className="h-full flex items-center justify-center text-sm text-slate-400 text-center py-8">
									Нема артикли. Скенирај баркод или пребарај производ.
								</div>
							) : (
								<div className="space-y-2">
									{cart.map((item) => (
										<CartItemCard
											key={item.product.id}
											item={item}
											busy={busy}
											autoFocusQty={focusProductId === item.product.id}
											onRemove={() => {
												setFocusProductId(null);
												removeItem(item.product.id);
											}}
											onQtyChange={(q) => {
												setFocusProductId(null);
												changeQty(item.product.id, q);
											}}
											onFinalPriceChange={(raw) => {
												setFocusProductId(null);
												patchFinalPrice(item.product.id, raw);
											}}
											onFinalPriceBlur={() => clampFinalPriceOnBlur(item.product.id)}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* ── RIGHT: Checkout panel — fixed width, full height, internal scroll ── */}
				<div className="w-[320px] xl:w-[340px] shrink-0 flex flex-col min-h-0">
					<div className="card-panel flex-1 flex flex-col min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
							<TotalsPanel
								totals={totals}
								busy={busy}
								cartEmpty={cart.length === 0}
								note={note}
								onNoteChange={setNote}
								onSubmit={() => void handleSubmitSale()}
								paymentMethod={paymentMethod}
								onPaymentMethodChange={setPaymentMethod}
								cashReceivedStr={cashReceivedStr}
								onCashReceivedStrChange={setCashReceivedStr}
								fiscalWarnings={fiscalWarnings}
							/>
						</div>
					</div>
				</div>
			</div>

			<ScannerModal
				open={scannerOpen}
				scanError={scanError}
				onClose={() => setScannerOpen(false)}
				onScan={handleScan}
				onError={(err) => {
					console.error(err);
					setScanError('Грешка при пристап до камерата.');
				}}
			/>
		</div>
	);
};

export default SalesPage;
