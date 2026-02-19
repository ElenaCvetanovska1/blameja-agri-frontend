'use client';

import { useRef, useState } from 'react';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';
import { supabase } from 'app/lib/supabase-client';

import type { ProductStockRow } from './types';
import { parseDigitsText } from './utils';
import { useOutsideClick } from './hooks/useOutsideClick';
import { useProductSearch } from './hooks/useProductSearch';
import { useCart } from './hooks/useCart';
import { useSalesSubmit } from './hooks/useSalesSubmit';

import { CodeInputWithSuggestions } from './components/CodeInputWithSuggestions';
import { CartItemCard } from './components/CartItemCard';
import { TotalsPanel } from './components/TotalsPanel';
import { ScannerModal } from './components/ScannerModal';

const fetchProductFromStockByExactCode = async (code: string): Promise<ProductStockRow | null> => {
	const trimmed = code.trim();
	if (!trimmed) return null;

	const pluText = parseDigitsText(trimmed);

	const orParts: string[] = [];
	orParts.push(`barcode.eq.${trimmed}`);
	if (pluText) orParts.push(`plu.eq.${pluText}`);

	const { data, error } = await supabase
		.from('product_stock')
		.select('product_id, plu, barcode, name, selling_price, qty_on_hand, category_name')
		.or(orParts.join(','))
		.limit(1)
		.maybeSingle();

	if (error) throw error;
	return (data ?? null) as ProductStockRow | null;
};

const SalesPage = () => {
	const [code, setCode] = useState('');
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);

	const [scannerOpen, setScannerOpen] = useState(false);
	const [scanError, setScanError] = useState<string | null>(null);

	const wrapRef = useRef<HTMLDivElement | null>(null);

	const { cart, totals, resetCart, updateItem, removeItem, changeQty, addToCartFromRow } = useCart();
	const { submitSale } = useSalesSubmit();

	const { suggestions, suggestOpen, setSuggestOpen, suggestLoading, setSuggestions } = useProductSearch(code);

	useOutsideClick(wrapRef, () => setSuggestOpen(false));

	const resetSale = () => {
		setCode('');
		setNote('');
		resetCart();
		setScanError(null);
		setSuggestions([]);
		setSuggestOpen(false);
	};

	const handleAddByCode = async (codeValue?: string) => {
		const value = (codeValue ?? code).trim();
		if (!value) {
			toast.error('Внеси баркод или PLU.');
			return;
		}

		setBusy(true);
		try {
			const row = await fetchProductFromStockByExactCode(value);

			if (!row) {
				toast.error('Не е пронајден производ со овој баркод/шифра.');
				return;
			}

			await addToCartFromRow(row);

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
			await submitSale({
				cart,
				totals,
				note,
				onSuccess: resetSale,
			});
		} catch (e) {
			console.error(e);
			toast.error('Грешка при зачувување на продажбата.');
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
		<div className="max-w-4xl mx-auto space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-bold text-slate-800">Продажба</h1>

				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => {
							setScanError(null);
							setScannerOpen(true);
						}}
						className="rounded-3xl bg-blamejaGreen px-8 py-4 text-md font-semibold text-white shadow-sm hover:bg-blamejaGreenDark disabled:opacity-60"
						disabled={busy}
					>
						Скенирај баркод
					</button>

					{scanError && <p className="text-xs text-blamejaRed">{scanError}</p>}
				</div>
			</div>

			<div className="rounded-2xl bg-white p-4 md:p-6 shadow-sm border border-slate-200">
				<CodeInputWithSuggestions
					value={code}
					onChange={setCode}
					onEnter={() => void handleAddByCode()}
					busy={busy}
					wrapRef={wrapRef}
					suggestions={suggestions}
					suggestOpen={suggestOpen}
					suggestLoading={suggestLoading}
					onOpenIfHasSuggestions={() => {
						if (suggestions.length > 0) setSuggestOpen(true);
					}}
					onCloseSuggestions={() => setSuggestOpen(false)}
					onPickSuggestion={(row) => {
						setSuggestOpen(false);
						void addToCartFromRow(row);
						setCode('');
					}}
				/>
			</div>

			<div className="rounded-2xl bg-white p-4 md:p-6 shadow-sm border border-slate-200 space-y-4">
				<div className="flex items-center justify-between">
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
								onRemove={() => removeItem(item.product.id)}
								onQtyChange={(q) => changeQty(item.product.id, q)}
								onPatch={(patch) => updateItem(item.product.id, patch)}
							/>
						))}
					</div>
				)}

				<div className="h-px bg-slate-200" />

				<TotalsPanel
					totals={totals}
					busy={busy}
					cartEmpty={cart.length === 0}
					note={note}
					onNoteChange={setNote}
					onSubmit={() => void handleSubmitSale()}
				/>
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
