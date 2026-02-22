'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { StockRow } from '../hooks/useStock';
import { useCategories } from '../hooks/useCategories';
import { useProductDetails } from '../hooks/useProductDetails';
import { useUpdateProductMutation } from '../hooks/useUpdateProductMutation';
import { useAdjustStockMutation } from '../hooks/useAdjustStockMutation';

// ✅ ADD: existing scanner modal
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { ScannerModal } from 'app/(app)/(sales)/components/ScannerModal';

const clampQty = (value: string) => {
	const cleaned = value.replace(',', '.');
	const num = Number.parseFloat(cleaned);
	if (!Number.isFinite(num) || num < 0) return '0';
	return String(num);
};

const parseNum = (v: string) => {
	const n = Number.parseFloat(v.trim().replace(',', '.'));
	return Number.isFinite(n) ? n : NaN;
};

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

const fmtQty = (n: number) => (Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0');

export function StockAdjustModal({ open, row, onClose }: { open: boolean; row: StockRow; onClose: () => void }) {
	const categoriesQ = useCategories();
	const detailsQ = useProductDetails(row.product_id, open);

	const updateProduct = useUpdateProductMutation();
	const adjustStock = useAdjustStockMutation();

	// form state
	const [plu, setPlu] = useState('');
	const [barcode, setBarcode] = useState('');
	const [name, setName] = useState('');
	const [sellingPrice, setSellingPrice] = useState('');
	const [categoryId, setCategoryId] = useState<string>('');

	const [qty, setQty] = useState('0');
	const [reason, setReason] = useState('');

	// ✅ ADD: scanner state
	const [scanOpen, setScanOpen] = useState(false);
	const [scanError, setScanError] = useState<string | null>(null);

	// init from DB product row (not from view)
	useEffect(() => {
		if (!detailsQ.data) return;

		setPlu(detailsQ.data.plu ?? '');
		setBarcode(detailsQ.data.barcode ?? '');
		setName(detailsQ.data.name ?? '');
		setSellingPrice(String(num(detailsQ.data.selling_price)));
		setCategoryId(detailsQ.data.category_id ?? '');
		setQty(String(num(row.qty_on_hand)));
		setReason('');

		// reset scanner state when opening
		setScanOpen(false);
		setScanError(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [detailsQ.data?.id, open]);

	const currentQty = num(row.qty_on_hand);
	const targetQtyNum = Number.isFinite(parseNum(qty)) ? parseNum(qty) : NaN;
	const delta = Number.isFinite(targetQtyNum) ? targetQtyNum - currentQty : null;

	const isBusy = updateProduct.isPending || adjustStock.isPending;

	const categoryOptions = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);

	// ✅ ADD: handlers for scanner
	const handleScan = (detected: IDetectedBarcode[]) => {
		// земи прв валиден резултат
		const first = detected?.[0] as any;
		const value = first?.rawValue ?? first?.value ?? '';
		const code = String(value).trim();

		if (!code) return;

		setBarcode(code);
		setScanError(null);
		setScanOpen(false);
		toast.success(`Скенирано: ${code}`);
	};

	const handleScanError = (err: unknown) => {
		setScanError(err instanceof Error ? err.message : 'Грешка при скенирање.');
	};

	const submit = async () => {
		// 1) update product fields
		try {
			const price = Number.parseFloat(sellingPrice.trim().replace(',', '.'));
			await updateProduct.mutateAsync({
				productId: row.product_id,
				name,
				barcode: barcode.trim() ? barcode : null,
				plu: plu.trim() ? plu : null,
				selling_price: Number.isFinite(price) ? price : NaN,
				category_id: categoryId ? categoryId : null,
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Грешка при зачувување на производ.');
			return;
		}

		// 2) adjust stock ONLY if changed
		const target = parseNum(qty);
		if (Number.isFinite(target)) {
			const d = target - currentQty;
			if (Math.abs(d) >= 0.0000001) {
				try {
					await adjustStock.mutateAsync({
						productId: row.product_id,
						targetQty: qty,
						currentQty,
						reason,
						unitPrice: num(row.selling_price),
						unitCost: 0,
					});
				} catch (e) {
					toast.error(e instanceof Error ? e.message : 'Грешка при корекција на залиха.');
					return;
				}
			}
		}

		toast.success('Зачувано ✅');
		onClose();
	};

	if (!open) return null;

	return (
		<>
			<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
				<div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden">
					<div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
						<div>
							<div className="text-sm font-semibold">Корекција (производ + залиха)</div>
							<div className="text-xs text-slate-500">ID: {row.product_id}</div>
						</div>

						<button
							type="button"
							onClick={onClose}
							className="text-sm text-slate-600 hover:text-slate-900"
						>
							Затвори ✕
						</button>
					</div>

					<div className="p-4 space-y-4">
						{detailsQ.isLoading && <div className="text-sm text-slate-500">Се вчитуваат детали...</div>}

						{detailsQ.isError && (
							<div className="text-sm text-red-600">
								Грешка при детали: {detailsQ.error instanceof Error ? detailsQ.error.message : 'unknown'}
							</div>
						)}

						{/* Product fields */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="block text-xs font-medium text-slate-600">Име</label>
								<input
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
									focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-600">Продажна цена</label>
								<input
									value={sellingPrice}
									onChange={(e) => setSellingPrice(e.target.value)}
									inputMode="decimal"
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
									focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-600">PLU</label>
								<input
									value={plu}
									onChange={(e) => setPlu(e.target.value)}
									placeholder="само бројки (опц.)"
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
									focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
								/>
							</div>

							{/* ✅ UPDATED: Barcode input + Scan button */}
							<div>
								<label className="block text-xs font-medium text-slate-600">Баркод</label>

								<div className="mt-1 flex gap-2">
									<input
										value={barcode}
										onChange={(e) => setBarcode(e.target.value)}
										placeholder="опц."
										className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
										focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
									/>

									<button
										type="button"
										onClick={() => {
											setScanError(null);
											setScanOpen(true);
										}}
										className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold
										text-slate-700 hover:bg-slate-50"
									>
										Скенирај
									</button>
								</div>

								{scanError && <div className="mt-1 text-xs text-blamejaRed">{scanError}</div>}
							</div>

							<div className="sm:col-span-2">
								<label className="block text-xs font-medium text-slate-600">Категорија</label>
								<select
									value={categoryId}
									onChange={(e) => setCategoryId(e.target.value)}
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
								>
									<option value="">— Без категорија —</option>
									{categoryOptions.map((c) => (
										<option
											key={c.id}
											value={c.id}
										>
											{c.name}
										</option>
									))}
								</select>
								{categoriesQ.isError && <div className="mt-1 text-xs text-red-600">Не можам да вчитам категории.</div>}
							</div>
						</div>

						{/* Stock fields */}
						<div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
							<div className="text-xs font-semibold text-slate-700">Залиха</div>

							<div className="mt-2 flex items-center gap-2 flex-wrap">
								<input
									value={qty}
									onChange={(e) => setQty(e.target.value)}
									onBlur={() => setQty((v) => clampQty(v))}
									inputMode="decimal"
									className="h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm text-center
									focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
								/>

								<div className="text-xs text-slate-600">
									Тековна: <b>{fmtQty(currentQty)}</b>
									{delta !== null && (
										<>
											{' '}
											• Промена:{' '}
											<b className={delta >= 0 ? 'text-blamejaGreen' : 'text-blamejaRed'}>
												{delta >= 0 ? '+' : ''}
												{fmtQty(delta)}
											</b>
										</>
									)}
								</div>
							</div>

							<div className="mt-3">
								<label className="block text-xs font-medium text-slate-600">Причина (само ако менуваш залиха)</label>
								<textarea
									value={reason}
									onChange={(e) => setReason(e.target.value)}
									rows={2}
									placeholder="пр. Попис / корекција..."
									className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
									focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
								/>
							</div>
						</div>
					</div>

					<div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
						<button
							type="button"
							onClick={onClose}
							className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
						>
							Откажи
						</button>

						<button
							type="button"
							onClick={submit}
							disabled={isBusy || detailsQ.isLoading}
							className="rounded-full bg-blamejaGreen px-5 py-2 text-xs font-semibold text-white
							hover:bg-blamejaGreenDark disabled:opacity-60 disabled:cursor-not-allowed"
						>
							{isBusy ? 'Се зачувува...' : 'Зачувај'}
						</button>
					</div>
				</div>
			</div>

			{/* ✅ ADD: Scanner modal */}
			<ScannerModal
				open={scanOpen}
				scanError={scanError}
				onClose={() => setScanOpen(false)}
				onScan={handleScan}
				onError={handleScanError}
			/>
		</>
	);
}
