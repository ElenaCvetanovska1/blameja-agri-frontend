'use client';

import { useRef, useState } from 'react';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';
import { api } from 'app/lib/api-client';

import type { ProductStockRow } from './types';
import { num } from './utils';
import { useOutsideClick } from './hooks/useOutsideClick';
import { useProductSearch } from './hooks/useProductSearch';
import { useCart } from './hooks/useCart';
import { useSalesSubmit } from './hooks/useSalesSubmit';
import { useFiscalSaleFlow } from './hooks/useFiscalSaleFlow';

import { CodeInputWithSuggestions } from './components/CodeInputWithSuggestions';
import { CartItemCard } from './components/CartItemCard';
import { ScannerModal } from './components/ScannerModal';
import { TotalsPanel } from './components/TotalsPanel';

const fetchProductFromStockByExactCode = async (code: string, storeNo: 20 | 30): Promise<ProductStockRow | null> => {
	const trimmed = code.trim();
	if (!trimmed) return null;

	const product = await api.get<ProductStockRow | null>(
		`/api/sales/products/lookup?code=${encodeURIComponent(trimmed)}&storeNo=${storeNo}`,
	);

	return product ?? null;
};

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

	const wrapRef = useRef<HTMLDivElement | null>(null);

	const { cart, totals, resetCart, removeItem, changeQty, addToCartFromRow, patchFinalPrice, clampFinalPriceOnBlur } = useCart();
	const { submitSale } = useSalesSubmit();
	const { runFiscalSale } = useFiscalSaleFlow();

	const { suggestions, suggestOpen, setSuggestOpen, suggestLoading, setSuggestions } = useProductSearch(code, storeNo);

	useOutsideClick(wrapRef, () => setSuggestOpen(false));

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

	const handleAddByCode = async (codeValue?: string) => {
		const value = (codeValue ?? code).trim();
		if (!value) {
			toast.error('Внеси баркод или PLU.');
			return;
		}

		setBusy(true);
		try {
			const row = await fetchProductFromStockByExactCode(value, storeNo);

			if (!row) {
				toast.error(`Не е пронајден производ во продавница ${storeNo}.`);
				return;
			}

			const qoh = num(row.qty_on_hand);
			if (qoh <= 0) {
				toast.warning(`Внимание: залиха ${qoh}. Ќе дозволи продажба во минус.`);
			}

			const addedProductId = await addToCartFromRow(row);
			if (addedProductId) setFocusProductId(addedProductId);

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
			const { receiptId } = await submitSale({
				cart,
				totals,
				note,
				paymentMethod,
				cashReceivedStr,
				onSuccess: resetSale,
			});

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

	const handleScanError = (err: unknown) => {
		console.error(err);
		setScanError('Грешка при пристап до камерата.');
	};

	return (
		<div className="px-4 ">
			<div className="max-w-[1200px] mx-auto">
				<div className="mb-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
					<CodeInputWithSuggestions
						value={code}
						onChange={(v) => {
							setCode(v);
							if (v.trim().length > 0) setSuggestOpen(true);
							if (v.trim().length === 0) setSuggestOpen(false);
							setFocusProductId(null);
						}}
						onEnter={() => void handleAddByCode()}
						busy={busy}
						wrapRef={wrapRef}
						suggestions={suggestions}
						suggestOpen={suggestOpen}
						suggestLoading={suggestLoading}
						onOpenIfHasSuggestions={() => {
							if (code.trim().length > 0) setSuggestOpen(true);
						}}
						onCloseSuggestions={() => setSuggestOpen(false)}
						onPickSuggestion={async (row) => {
							setSuggestOpen(false);

							const qoh = num(row.qty_on_hand);
							if (qoh <= 0) toast.warning(`Внимание: залиха ${qoh}. Ќе дозволи продажба во минус.`);

							const addedProductId = await addToCartFromRow(row);
							if (addedProductId) setFocusProductId(addedProductId);

							setCode('');
							setSuggestions([]);
						}}
						onOpenScanner={() => {
							setScanError(null);
							setScannerOpen(true);
						}}
						storeNo={storeNo}
						onStoreNoChange={(v) => {
							setStoreNo(v);
							setCode('');
							setSuggestions([]);
							setSuggestOpen(false);
						}}
					/>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
					<div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 max-h-[60vh] overflow-auto">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-lg font-semibold text-slate-800">Кошничка</h2>

							<button
								type="button"
								onClick={resetSale}
								className="text-xs font-semibold text-slate-600 hover:text-slate-800"
								disabled={busy}
							>
								Ресет
							</button>
						</div>

						{cart.length === 0 ? (
							<div className="text-sm text-slate-500">Нема додадени артикли. Скенирај баркод или избери од листата.</div>
						) : (
							<div className="space-y-3">
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

					<div className="lg:sticky lg:top-6">
						<div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
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
				onError={handleScanError}
			/>
		</div>
	);
};

export default SalesPage;
