'use client';

import { useMemo, useState } from 'react';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { supabase } from 'app/lib/supabase-client';
import { toast } from 'sonner';

type Product = {
	id: string;
	sku: string;
	barcode: string | null;
	name: string;
	selling_price: number;
	vat_rate: number;
};

type CartItem = {
	product: Product;
	qty: number;
	price: number; // base unit price
	discountPercent: number; // 0..100
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const fetchProductByCode = async (code: string): Promise<Product | null> => {
	const trimmed = code.trim();
	if (!trimmed) return null;

	const { data, error } = await supabase
		.from('products')
		.select('id, sku, barcode, name, selling_price, vat_rate')
		.or(`barcode.eq.${trimmed},sku.eq.${trimmed}`)
		.maybeSingle();

	if (error) throw error;
	return (data as Product) ?? null;
};

const fetchAvailableStock = async (productId: string): Promise<number> => {
	// sum movement items by movement type
	const { data, error } = await supabase
		.from('stock_movement_items')
		.select('qty, stock_movements!inner(type)')
		.eq('product_id', productId);

	if (error) throw error;

	let total = 0;
	for (const row of data ?? []) {
		const qty = Number((row as any).qty ?? 0);
		const type = (row as any).stock_movements?.type as 'IN' | 'OUT' | 'ADJUST' | undefined;

		if (type === 'OUT') total -= qty;
		else total += qty; // IN / ADJUST
	}

	return Number.isFinite(total) ? total : 0;
};

const SalesPage = () => {
	const [code, setCode] = useState('');
	const [note, setNote] = useState('');
	const [cart, setCart] = useState<CartItem[]>([]);
	const [busy, setBusy] = useState(false);

	const [scannerOpen, setScannerOpen] = useState(false);
	const [scanError, setScanError] = useState<string | null>(null);

	const totals = useMemo(() => {
		const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

		const discountTotal = cart.reduce((sum, item) => {
			const discPerUnit = item.price * (item.discountPercent / 100);
			return sum + item.qty * discPerUnit;
		}, 0);

		const total = subtotal - discountTotal;

		return {
			subtotal: round2(subtotal),
			discountTotal: round2(discountTotal),
			total: round2(total),
		};
	}, [cart]);

	const resetSale = () => {
		setCode('');
		setNote('');
		setCart([]);
		setScanError(null);
	};

	const updateItem = (productId: string, patch: Partial<CartItem>) => {
		setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, ...patch } : i)));
	};

	const removeItem = (productId: string) => {
		setCart((prev) => prev.filter((i) => i.product.id !== productId));
	};

	const handleAddByCode = async (codeValue?: string) => {
		const value = (codeValue ?? code).trim();
		if (!value) {
			toast.error('Внеси баркод или SKU.');
			return;
		}

		setBusy(true);
		try {
			const product = await fetchProductByCode(value);

			if (!product) {
				toast.error('Не е пронајден производ со овој баркод/шифра.');
				return;
			}

			const available = await fetchAvailableStock(product.id);
			const inCart = cart.find((c) => c.product.id === product.id)?.qty ?? 0;

			if (available <= inCart) {
				toast.error(`Нема доволно залиха. Достапно: ${available}, во кошничка: ${inCart}.`);
				return;
			}

			setCart((prev) => {
				const existing = prev.find((p) => p.product.id === product.id);
				if (!existing) {
					return [
						...prev,
						{
							product,
							qty: 1,
							price: Number(product.selling_price ?? 0),
							discountPercent: 0,
						},
					];
				}

				return prev.map((p) => (p.product.id === product.id ? { ...p, qty: p.qty + 1 } : p));
			});

			setCode('');
			toast.success(`Додадено: ${product.name}`);
		} catch (e) {
			console.error(e);
			toast.error('Грешка при барање на производ.');
		} finally {
			setBusy(false);
		}
	};

	const handleSubmitSale = async () => {
		if (cart.length === 0) {
			toast.error('Кошничката е празна.');
			return;
		}

		setBusy(true);
		try {
			// validate stock for each item
			for (const item of cart) {
				const available = await fetchAvailableStock(item.product.id);
				if (available < item.qty) {
					toast.error(`Нема доволно залиха за "${item.product.name}". Достапно: ${available}, бараш: ${item.qty}.`);
					setBusy(false);
					return;
				}
			}

			// 1) Create internal receipt/event (payment is required in schema)
			const { data: receipt, error: receiptError } = await supabase
				.from('sales_receipts')
				.insert({
					payment: 'OTHER',
					total: totals.total,
				})
				.select('id, receipt_no')
				.single();

			if (receiptError) throw receiptError;

			const receiptId = receipt.id as string;
			const receiptNo = receipt.receipt_no as number;

			// 2) Insert sales items
			const salesItemsPayload = cart.map((item) => {
				const discountPerUnit = item.price * (item.discountPercent / 100);
				return {
					receipt_id: receiptId,
					product_id: item.product.id,
					qty: item.qty,
					price: item.price,
					discount: discountPerUnit,
				};
			});

			const { error: salesItemsError } = await supabase.from('sales_items').insert(salesItemsPayload);

			if (salesItemsError) throw salesItemsError;

			// 3) Stock movement OUT
			const { data: movement, error: movementError } = await supabase
				.from('stock_movements')
				.insert({
					type: 'OUT',
					note: note?.trim() ? note.trim() : `Internal sale #${receiptNo}`,
				})
				.select('id')
				.single();

			if (movementError) throw movementError;

			const movementId = movement.id as string;

			const movementItemsPayload = cart.map((item) => {
				const discountPerUnit = item.price * (item.discountPercent / 100);
				const finalUnit = item.price - discountPerUnit;

				return {
					movement_id: movementId,
					product_id: item.product.id,
					qty: item.qty,
					unit_cost: 0,
					unit_price: finalUnit,
				};
			});

			const { error: movementItemsError } = await supabase.from('stock_movement_items').insert(movementItemsPayload);

			if (movementItemsError) throw movementItemsError;

			toast.success(`Продажба зачувана ✅ (Интерно #${receiptNo})`);
			resetSale();
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
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold text-slate-800">Продажба</h1>
						<p className="text-sm text-slate-600">Интерна продажба со баркод читач. Додај артикли во кошничка и зачувај.</p>
					</div>

					<button
						type="button"
						onClick={() => {
							setScanError(null);
							setScannerOpen(true);
						}}
						className="rounded-full bg-blamejaGreen px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blamejaGreenDark disabled:opacity-60"
						disabled={busy}
					>
						Скенирај
					</button>
				</div>

				{scanError && <p className="text-xs text-blamejaRed">{scanError}</p>}
			</div>

			{/* Add line */}
			<div className="rounded-2xl bg-white p-4 md:p-6 shadow-sm border border-slate-200">
				<div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
					<div className="space-y-1">
						<label className="block text-xs font-medium text-slate-600">Баркод или SKU</label>
						<input
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="Скенирај или внеси код…"
							className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                         focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
						/>
					</div>

					<button
						type="button"
						onClick={() => void handleAddByCode()}
						disabled={busy}
						className="rounded-lg bg-blamejaOrange px-4 py-2 text-sm font-semibold text-white
                       hover:bg-blamejaOrangeDark disabled:opacity-60"
					>
						{busy ? '...' : 'Додај'}
					</button>
				</div>
			</div>

			{/* Cart */}
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
					<div className="text-sm text-slate-500">Нема додадени артикли. Скенирај баркод.</div>
				) : (
					<div className="space-y-3">
						{cart.map((item) => {
							const discountPerUnit = item.price * (item.discountPercent / 100);
							const finalUnit = item.price - discountPerUnit;
							const lineTotal = round2(finalUnit * item.qty);

							return (
								<div
									key={item.product.id}
									className="rounded-xl border border-slate-200 p-3"
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="font-semibold text-slate-800 truncate">{item.product.name}</div>
											<div className="text-xs text-slate-500">
												SKU: <span className="font-medium">{item.product.sku}</span>
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
											onClick={() => removeItem(item.product.id)}
											className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
											disabled={busy}
										>
											Отстрани
										</button>
									</div>

									<div className="mt-3 grid gap-3 md:grid-cols-4 md:items-end">
										<div className="space-y-1">
											<label className="block text-xs font-medium text-slate-600">Количина</label>
											<input
												type="number"
												min={1}
												value={item.qty}
												onChange={(e) =>
													updateItem(item.product.id, {
														qty: Math.max(1, Number(e.target.value) || 1),
													})
												}
												className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                                   focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
											/>
										</div>

										<div className="space-y-1">
											<label className="block text-xs font-medium text-slate-600">Цена (ден/ед.)</label>
											<input
												type="number"
												min={0}
												step="0.01"
												value={item.price}
												onChange={(e) =>
													updateItem(item.product.id, {
														price: Math.max(0, Number(e.target.value) || 0),
													})
												}
												className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                                   focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
											/>
										</div>

										<div className="space-y-1">
											<label className="block text-xs font-medium text-slate-600">Попуст (%)</label>
											<input
												type="number"
												min={0}
												max={100}
												step="1"
												value={item.discountPercent}
												onChange={(e) =>
													updateItem(item.product.id, {
														discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
													})
												}
												className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                                   focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
											/>
										</div>

										<div className="space-y-1">
											<label className="block text-xs font-medium text-slate-600">Вкупно</label>
											<div className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
												{lineTotal.toFixed(2)} ден.
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Totals + note + submit */}
			<div className="rounded-2xl bg-white p-4 md:p-6 shadow-sm border border-slate-200 space-y-4">
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<label className="block text-xs font-medium text-slate-600">Забелешка (опционално)</label>
						<textarea
							value={note}
							onChange={(e) => setNote(e.target.value)}
							rows={2}
							placeholder="Пр. напомена, кој земал, за која намена…"
							className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                         focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
							disabled={busy}
						/>
					</div>

					<div className="space-y-2">
						<div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
							<div className="flex items-center justify-between text-sm">
								<span className="text-slate-600">Сума</span>
								<span className="font-semibold text-slate-800">{totals.subtotal.toFixed(2)} ден.</span>
							</div>
							<div className="flex items-center justify-between text-sm mt-2">
								<span className="text-slate-600">Попуст</span>
								<span className="font-semibold text-slate-800">-{totals.discountTotal.toFixed(2)} ден.</span>
							</div>
							<div className="h-px bg-slate-200 my-3" />
							<div className="flex items-center justify-between">
								<span className="text-slate-700 font-semibold">Вкупно</span>
								<span className="text-lg font-bold text-slate-900">{totals.total.toFixed(2)} ден.</span>
							</div>
						</div>

						<button
							type="button"
							onClick={() => void handleSubmitSale()}
							disabled={busy || cart.length === 0}
							className="w-full rounded-lg bg-blamejaGreen px-4 py-3 text-sm font-semibold text-white
                         hover:bg-blamejaGreenDark disabled:opacity-60"
						>
							{busy ? 'Се зачувува...' : 'Зачувај продажба'}
						</button>
					</div>
				</div>
			</div>

			{/* Scanner overlay */}
			{scannerOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
					<div className="w-full max-w-md rounded-2xl bg-white p-4">
						<div className="mb-2 flex items-center justify-between">
							<h2 className="text-sm font-semibold">Скенирај баркод / QR</h2>
							<button
								type="button"
								onClick={() => setScannerOpen(false)}
								className="text-sm text-slate-600"
							>
								Затвори ✕
							</button>
						</div>

						<p className="mb-2 text-xs text-slate-500">Насочи ја камерата кон етикетата. По читање, производот ќе се додаде во кошничка.</p>

						<div className="overflow-hidden rounded-xl border border-slate-200">
							<Scanner
								onScan={handleScan}
								onError={handleScanError}
								constraints={{ facingMode: 'environment' }}
							/>
						</div>

						{scanError && <p className="mt-2 text-xs text-blamejaRed">{scanError}</p>}
					</div>
				</div>
			)}
		</div>
	);
};

export default SalesPage;
