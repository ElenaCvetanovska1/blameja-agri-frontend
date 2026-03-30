'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from 'app/lib/api-client';
import {
	FiPackage,
	FiFileText,
	FiCamera,
	FiRotateCcw,
	FiSave,
	FiTag,
	FiBarChart2,
	FiHash,
} from 'react-icons/fi';

import { useReceiveMutation, type ReceivePayload } from './hooks/useReceiveMutation';
import { useCategoryOptions } from './hooks/useCategoryOptions';
import { useProductChoices } from './hooks/useProductChoices';
import { useReceiveForm } from './hooks/useReceiveForm';
import { useSupplierChoices, type SupplierRow } from './hooks/useSupplierChoices';
import { useUpdateSupplierAddressMutation } from './hooks/useUpdateSupplierAddressMutation';

import ProductNameWithSuggestions from './components/ProductNameWithSuggestions';
import { SupplierInputWithSuggestions } from './components/SupplierInputWithSuggestions';
import { ScannerModal } from './components/ScannerModal';

import { KPK_CODE, KPK_FISCAL_PLU, normalizeTaxGroup, num } from './utils';
import type { ProductChoiceRow, TaxGroup, Unit, StoreNo } from './types';

type SupplierGetOrCreateRow = { id: string; name: string; address: string | null };

/* ─── Section header ─── */
function SectionHeader({
	icon: Icon,
	title,
	hint,
}: {
	icon: React.ElementType;
	title: string;
	hint?: string;
}) {
	return (
		<div className="flex items-center justify-between mb-4">
			<div className="flex items-center gap-2">
				<div className="h-7 w-7 rounded-lg bg-blamejaGreenSoft flex items-center justify-center">
					<Icon className="w-3.5 h-3.5 text-blamejaGreenDark" />
				</div>
				<h2 className="text-sm font-bold text-slate-800">{title}</h2>
			</div>
			{hint && <span className="text-[11px] text-slate-400">{hint}</span>}
		</div>
	);
}

/* ─── Field wrapper ─── */
function Field({
	label,
	htmlFor,
	required,
	children,
}: {
	label: string;
	htmlFor?: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div>
			<label className="form-label" htmlFor={htmlFor}>
				{label}
				{required && <span className="text-red-500 ml-0.5">*</span>}
			</label>
			{children}
		</div>
	);
}

/* ─── Tax Group buttons ─── */
function TaxGroupButtons({
	value,
	onChange,
}: {
	value: TaxGroup;
	onChange: (v: TaxGroup) => void;
}) {
	return (
		<div className="flex gap-2 mt-1.5">
			{(['5', '10', '18'] as const).map((v) => (
				<button
					key={v}
					type="button"
					onClick={() => onChange(v)}
					className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all
						${value === v
							? 'border-blamejaGreen bg-blamejaGreen text-white shadow-sm'
							: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
						}`}
				>
					{v}%
				</button>
			))}
		</div>
	);
}

/* ─────────────────────────────────────────────────
   RECEIVE PAGE
───────────────────────────────────────────────── */
const ReceivePage = () => {
	const form = useReceiveForm();
	const [storeNo, setStoreNo] = useState<StoreNo>(20);
	const [invoiceNo, setInvoiceNo] = useState('');
	const [supplierName, setSupplierName] = useState('');
	const [supplierAddress, setSupplierAddress] = useState('');
	const [invoiceDate, setInvoiceDate] = useState('');
	const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
	const [selectedSupplierHadAddress, setSelectedSupplierHadAddress] = useState<boolean>(true);
	const [openAllSuppliers, setOpenAllSuppliers] = useState(false);
	const [_selectedProductId, setSelectedProductId] = useState<string | null>(null);
	const [scannerOpen, setScannerOpen] = useState(false);
	const [scanError, setScanError] = useState<string | null>(null);

	const categoriesQuery = useCategoryOptions();

	const selectedCategory = useMemo(
		() => (categoriesQuery.data ?? []).find((c) => c.id === form.categoryId) ?? null,
		[categoriesQuery.data, form.categoryId],
	);

	const isKpk = useMemo(
		() => (selectedCategory?.code ?? '').toLowerCase() === KPK_CODE,
		[selectedCategory],
	);

	const choicesQuery = useProductChoices({ name: form.name, categoryId: form.categoryId, storeNo, limit: 10 });

	const normalizedChoices: ProductChoiceRow[] = (choicesQuery.data ?? []).map((c) => ({
		product_id: c.id,
		name: c.name ?? null,
		plu: c.plu ?? null,
		barcode: c.barcode ?? null,
		selling_price: c.selling_price ?? null,
		tax_group: c.tax_group ?? null,
		category_id: c.category_id ?? null,
		category_name: (c as Record<string, unknown> & { categories?: { name?: string }[] }).categories?.[0]?.name ?? null,
		unit: (c.unit ?? 'пар') as Unit,
		store_no: (c.store_no ?? storeNo) as StoreNo,
	}));

	const suppliersQuery = useSupplierChoices({
		q: supplierName,
		limit: openAllSuppliers ? 1000 : 12,
		openAll: openAllSuppliers,
	});

	const updateAddressMutation = useUpdateSupplierAddressMutation();
	const receiveMutation = useReceiveMutation();

	const isSubmitDisabled = receiveMutation.isPending || categoriesQuery.isLoading || !!categoriesQuery.error || !form.isValid;

	const onPickProduct = (row: ProductChoiceRow) => {
		setSelectedProductId(row.product_id);
		form.setName((row.name ?? '').trim());
		if (row.category_id) form.setCategoryId(row.category_id);
		form.setPlu((row.plu ?? '').trim());
		form.setBarcode(row.barcode ?? '');
		form.setSellingPrice(row.selling_price === null ? '' : String(num(row.selling_price)));
		form.setTaxGroup(normalizeTaxGroup(row.tax_group) as TaxGroup);
		form.setUnit((row.unit ?? 'пар') as 'пар' | 'кг' | 'м');
		toast.success('Избран производ ✅');
	};

	const onPickSupplier = (row: SupplierRow) => {
		setSelectedSupplierId(row.id);
		setSupplierName(row.name);
		setSupplierAddress(row.address ?? '');
		setSelectedSupplierHadAddress(!!(row.address ?? '').trim());
		setOpenAllSuppliers(false);
		toast.message('Избран добавувач', { description: row.name });
	};

	const ensureSupplierExists = async (): Promise<string | null> => {
		const name = supplierName.trim();
		const addr = supplierAddress.trim();
		if (!name) return null;
		if (selectedSupplierId) return selectedSupplierId;

		const row = await api.post<SupplierGetOrCreateRow>('/api/suppliers/get-or-create', {
			name,
			address: addr.length ? addr : null,
		});
		if (!row?.id) throw new Error('Не успеа креирање/наоѓање на добавувач.');
		setSelectedSupplierId(row.id);
		setSupplierName(row.name);
		setSupplierAddress(row.address ?? '');
		setSelectedSupplierHadAddress(!!(row.address ?? '').trim());
		return row.id;
	};

	const maybeUpdateSupplierAddress = async (supplierId: string | null) => {
		if (!supplierId || selectedSupplierHadAddress) return;
		const addr = supplierAddress.trim();
		if (!addr) return;
		await new Promise<void>((resolve, reject) => {
			updateAddressMutation.mutate(
				{ supplierId, address: addr },
				{
					onSuccess: () => { setSelectedSupplierHadAddress(true); resolve(); },
					onError: (err) => reject(err),
				},
			);
		});
	};

	const resetAll = () => {
		setSelectedProductId(null);
		form.reset();
		setInvoiceNo('');
		setSupplierName('');
		setSupplierAddress('');
		setInvoiceDate('');
		setSelectedSupplierId(null);
		setSelectedSupplierHadAddress(true);
		setOpenAllSuppliers(false);
	};

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		try {
			const supplierId = await ensureSupplierExists();
			await maybeUpdateSupplierAddress(supplierId);
			const payload: ReceivePayload = {
				plu: form.plu,
				barcode: form.barcode,
				name: form.name,
				sellingPrice: form.sellingPrice,
				qty: form.qty,
				unitCost: form.unitCost,
				description: form.details,
				note: form.details,
				categoryId: form.categoryId,
				taxGroup: form.taxGroup,
				unit: form.unit,
				supplierId,
				storeNo,
			};
			await receiveMutation.mutateAsync(payload);
			toast.success('Приемот е успешно зачуван ✅');
			resetAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Грешка при зачувување.');
		}
	};

	return (
		<div className="flex flex-col h-full min-h-0 gap-3">

			{/* ══════════════════════════════════════
			    PAGE HEADER — shrink-0
			══════════════════════════════════════ */}
			<div className="flex items-center justify-between shrink-0">
				<div className="flex items-center gap-3">
					<div className="h-10 w-10 rounded-xl bg-blamejaGreenSoft flex items-center justify-center">
						<FiPackage className="w-5 h-5 text-blamejaGreenDark" />
					</div>
					<div>
						<h1 className="text-xl font-bold text-slate-900">Прием на стока</h1>
						<p className="text-xs text-slate-500">Внеси нова испорака во залиха</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold text-slate-500">Продавница</span>
						<select
							value={storeNo}
							onChange={(e) => setStoreNo(Number(e.target.value) as StoreNo)}
							className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700"
						>
							<option value={20}>Бр. 20</option>
							<option value={30}>Бр. 30</option>
						</select>
					</div>

					<button
						type="button"
						onClick={() => { setScanError(null); setScannerOpen(true); }}
						className="flex items-center gap-2 h-9 px-3 rounded-lg bg-blamejaGreen text-white text-sm font-semibold hover:bg-blamejaGreenDark transition-colors"
					>
						<FiCamera className="w-4 h-4" />
						<span className="hidden sm:inline">Скенирај</span>
					</button>
				</div>
			</div>

			{/* ══════════════════════════════════════
			    TWO-COLUMN FORM (desktop)
			    Left: Document + Product + Actions (scrolls)
			    Right: Prices panel (fixed width, visible)
			══════════════════════════════════════ */}
			<form onSubmit={onSubmit} className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 lg:overflow-hidden">

				{/* ── LEFT COLUMN ── */}
				<div className="flex-1 lg:min-h-0 lg:overflow-y-auto space-y-4 pb-2">

					{/* CARD 1: Document & Supplier */}
					<div className="card px-5 py-4">
						<SectionHeader icon={FiFileText} title="Документ и добавувач" />

						<div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
							<div className="sm:col-span-3">
								<Field label="Број на фактура" htmlFor="receive-invoice-no">
									<input
										id="receive-invoice-no"
										value={invoiceNo}
										onChange={(e) => setInvoiceNo(e.target.value)}
										className="form-input"
										placeholder="пр. 123/2026"
									/>
								</Field>
							</div>

							<div className="sm:col-span-2">
								<Field label="Датум" htmlFor="receive-invoice-date">
									<input
										id="receive-invoice-date"
										type="date"
										value={invoiceDate}
										onChange={(e) => setInvoiceDate(e.target.value)}
										className="form-input"
									/>
								</Field>
							</div>

							<div className="sm:col-span-4">
								<div className="form-label">Добавувач</div>
								<SupplierInputWithSuggestions
									value={supplierName}
									onChange={(v) => {
										setSupplierName(v);
										setSelectedSupplierId(null);
										setSelectedSupplierHadAddress(true);
									}}
									onPick={onPickSupplier}
									suggestions={suppliersQuery.data ?? []}
									loading={suppliersQuery.isFetching}
									openAll={openAllSuppliers}
									onOpenAll={() => setOpenAllSuppliers(true)}
									onCloseAll={() => setOpenAllSuppliers(false)}
									placeholder="Добавувач…"
								/>
							</div>

							<div className="sm:col-span-3">
								<Field label="Адреса (опц.)" htmlFor="receive-supplier-address">
									<input
										id="receive-supplier-address"
										value={supplierAddress}
										onChange={(e) => setSupplierAddress(e.target.value)}
										className="form-input"
										placeholder="ул., место…"
									/>
								</Field>
							</div>

							{!selectedSupplierHadAddress && selectedSupplierId && (
								<div className="sm:col-span-12">
									<div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
										<span className="font-semibold">Напомена:</span>
										<span>Овој добавувач нема адреса во база. Ако внесеш адреса, ќе се зачува кога ќе кликнеш „Зачувај прием".</span>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* CARD 2: Product Entry */}
					<div className="card px-5 py-4">
						<SectionHeader icon={FiPackage} title="Производ" hint="Пребарај или внеси рачно" />

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
							<Field label="Категорија" htmlFor="receive-category">
								<select
									id="receive-category"
									value={form.categoryId}
									onChange={(e) => {
										form.setCategoryId(e.target.value);
										setSelectedProductId(null);
									}}
									disabled={categoriesQuery.isLoading || !!categoriesQuery.error}
									className="form-input"
								>
									<option value="">
										{categoriesQuery.isLoading ? 'Се вчитува...' : 'Избери категорија'}
									</option>
									{(categoriesQuery.data ?? []).map((c) => (
										<option key={c.id} value={c.id}>{c.name}</option>
									))}
								</select>
								{categoriesQuery.error && (
									<p className="mt-1 text-xs text-red-600">Грешка при вчитување категории.</p>
								)}
							</Field>

							{isKpk && (
								<Field label="Фискална шифра (фиксно)" htmlFor="receive-fiscal-plu">
									<input
										id="receive-fiscal-plu"
										value={String(KPK_FISCAL_PLU)}
										readOnly
										className="form-input bg-slate-50 text-slate-500 cursor-not-allowed"
									/>
								</Field>
							)}
						</div>

						<div className="mb-4">
							<div className="form-label">Назив на производ <span className="text-red-500">*</span></div>
							<ProductNameWithSuggestions
								value={form.name}
								onChange={(v) => {
									form.setName(v);
									setSelectedProductId(null);
								}}
								placeholder={
									form.categoryId
										? 'Почни да куцаш (во избрана категорија)…'
										: 'Почни да куцаш (ќе се пополни категорија)…'
								}
								loading={choicesQuery.isFetching}
								suggestions={normalizedChoices}
								onPick={onPickProduct}
							/>
						</div>

						<div className="grid grid-cols-2 sm:grid-cols-12 gap-4">
							<div className="sm:col-span-2">
								<Field label="PLU" htmlFor="receive-plu" required>
									<input
										id="receive-plu"
										value={form.plu}
										onChange={(e) => {
											form.setPlu(e.target.value.replace(/[^\d]/g, ''));
											setSelectedProductId(null);
										}}
										className="form-input"
										placeholder="пр. 125"
										inputMode="numeric"
									/>
								</Field>
							</div>

							<div className="sm:col-span-3">
								<Field label="Баркод (опц.)" htmlFor="receive-barcode">
									<div className="relative">
										<FiHash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
										<input
											id="receive-barcode"
											value={form.barcode}
											onChange={(e) => {
												form.setBarcode(e.target.value);
												setSelectedProductId(null);
											}}
											className="form-input pl-8"
											placeholder="3830…"
										/>
									</div>
								</Field>
							</div>

							<div className="sm:col-span-3">
								<div className="form-label flex items-center gap-1">
									<FiBarChart2 className="w-3.5 h-3.5" />
									ДДВ <span className="text-red-500">*</span>
								</div>
								<TaxGroupButtons value={form.taxGroup} onChange={(v) => { form.setTaxGroup(v); setSelectedProductId(null); }} />
							</div>

							<div className="sm:col-span-2">
								<Field label="Ед. мерка" htmlFor="receive-unit">
									<select
										id="receive-unit"
										value={form.unit ?? 'пар'}
										onChange={(e) => {
											form.setUnit(e.target.value as 'пар' | 'кг' | 'м');
											setSelectedProductId(null);
										}}
										className="form-input"
									>
										<option value="пар">пар</option>
										<option value="кг">кг</option>
										<option value="м">м</option>
									</select>
								</Field>
							</div>

							<div className="sm:col-span-2">
								<Field label="Количина" htmlFor="receive-qty" required>
									<input
										id="receive-qty"
										value={form.qty}
										onChange={(e) => form.setQty(e.target.value)}
										className="form-input"
										inputMode="decimal"
										placeholder="1"
									/>
								</Field>
							</div>
						</div>
					</div>

					{/* ACTIONS */}
					<div className="flex items-center justify-between gap-3 py-1">
						<button
							type="button"
							onClick={resetAll}
							className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
						>
							<FiRotateCcw className="w-4 h-4" />
							Ресетирај
						</button>

						<div className="flex items-center gap-3">
							<span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
								<span className="kbd">Enter</span>
								<span>Зачувај</span>
							</span>
							<button
								type="submit"
								disabled={isSubmitDisabled}
								className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all
									${isSubmitDisabled
										? 'bg-slate-200 text-slate-400 cursor-not-allowed'
										: 'bg-blamejaGreen text-white hover:bg-blamejaGreenDark shadow-md shadow-emerald-900/15 active:scale-[.99]'
									}`}
							>
								{receiveMutation.isPending ? (
									<>
										<span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
										Се зачувува...
									</>
								) : (
									<>
										<FiSave className="w-4 h-4" />
										Зачувај прием
									</>
								)}
							</button>
						</div>
					</div>
				</div>

				{/* ── RIGHT COLUMN: Prices ── */}
				<div className="lg:w-[300px] xl:w-[320px] shrink-0">
					<div className="card px-5 py-4 lg:h-full">
						<SectionHeader icon={FiTag} title="Цени" />

						<div className="space-y-4">
							<Field label="Набавна цена (ден.)" htmlFor="receive-unit-cost" required>
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">ден.</span>
									<input
										id="receive-unit-cost"
										value={form.unitCost}
										onChange={(e) => { form.setUnitCost(e.target.value); setSelectedProductId(null); }}
										className="form-input pl-12"
										inputMode="decimal"
										placeholder="0.00"
									/>
								</div>
							</Field>

							<Field label="Продажна цена (ден.)" htmlFor="receive-selling-price" required>
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">ден.</span>
									<input
										id="receive-selling-price"
										value={form.sellingPrice}
										onChange={(e) => { form.setSellingPrice(e.target.value); setSelectedProductId(null); }}
										className="form-input pl-12"
										inputMode="decimal"
										placeholder="0.00"
									/>
								</div>
							</Field>
						</div>

						{/* Margin indicator */}
						{form.unitCost && form.sellingPrice && (() => {
							const cost = parseFloat(form.unitCost);
							const sell = parseFloat(form.sellingPrice);
							if (cost > 0 && sell > 0) {
								const margin = ((sell - cost) / sell * 100).toFixed(1);
								const marginNum = parseFloat(margin);
								return (
									<div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold
										${marginNum < 0 ? 'bg-red-50 text-red-600 border border-red-100' :
										  marginNum < 10 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
										  'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}
									>
										<span>Маргина:</span>
										<span className="text-sm font-bold">{margin}%</span>
										<div className="mt-0.5 text-slate-400 font-normal">
											{cost.toFixed(2)} → {sell.toFixed(2)} ден.
										</div>
									</div>
								);
							}
							return null;
						})()}
					</div>
				</div>
			</form>

			<ScannerModal
				open={scannerOpen}
				onClose={() => setScannerOpen(false)}
				onScan={(raw) => {
					form.setBarcode(raw);
					toast.message('Скенирано', { description: raw });
				}}
				errorText={scanError}
				setErrorText={setScanError}
			/>
		</div>
	);
};

export default ReceivePage;
