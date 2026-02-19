'use client';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from 'app/lib/supabase-client';
import { useReceiveMutation, type ReceivePayload } from './hooks/useReceiveMutation';
import { useCategoryOptions } from './hooks/useCategoryOptions';
import { useProductChoices } from './hooks/useProductChoices';
import { useReceiveForm } from './hooks/useReceiveForm';
import { useSupplierChoices, type SupplierRow } from './hooks/useSupplierChoices';
import { useUpdateSupplierAddressMutation } from './hooks/useUpdateSupplierAddressMutation';
import { ProductNameWithSuggestions } from './components/ProductNameWithSuggestions';
import { SupplierInputWithSuggestions } from './components/SupplierInputWithSuggestions';
import { ScannerModal } from './components/ScannerModal';
import { KPK_CODE, KPK_FISCAL_PLU, normalizeTaxGroup, num } from './utils';
import type { ProductChoiceRow, TaxGroup } from './types';
type SupplierGetOrCreateRow = { id: string; name: string; address: string | null };
const ReceivePage = () => {
	const form = useReceiveForm();
	// Document fields (UI for now)
	const [invoiceNo, setInvoiceNo] = useState('');
	const [supplierName, setSupplierName] = useState('');
	const [supplierAddress, setSupplierAddress] = useState('');
	const [invoiceDate, setInvoiceDate] = useState('');
	// supplier selection tracking
	const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
	const [selectedSupplierHadAddress, setSelectedSupplierHadAddress] = useState<boolean>(true);
	// browse all suppliers toggle
	const [openAllSuppliers, setOpenAllSuppliers] = useState(false);
	const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
	const [scannerOpen, setScannerOpen] = useState(false);
	const [scanError, setScanError] = useState<string | null>(null);
	const categoriesQuery = useCategoryOptions();
	const selectedCategory = useMemo(() => {
		return (categoriesQuery.data ?? []).find((c) => c.id === form.categoryId) ?? null;
	}, [categoriesQuery.data, form.categoryId]);
	const isKpk = useMemo(() => {
		return (selectedCategory?.code ?? '').toLowerCase() === KPK_CODE;
	}, [selectedCategory]);
	const choicesQuery = useProductChoices({
		name: form.name,
		categoryId: form.categoryId,
		limit: 10,
	});
	// suppliers query: browse OR search
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
		const pickedName = (row.name ?? '').trim();
		form.setName(pickedName);
		if (row.category_id) form.setCategoryId(row.category_id);
		form.setPlu((row.plu ?? '').trim());
		form.setBarcode(row.barcode ?? '');
		form.setSellingPrice(row.selling_price === null ? '' : String(num(row.selling_price)));
		const tg = normalizeTaxGroup(row.tax_group) as TaxGroup;
		form.setTaxGroup(tg);
		toast.success('Избран производ ✅');
	};
	const onPickSupplier = (row: SupplierRow) => {
		setSelectedSupplierId(row.id);
		setSupplierName(row.name);
		setSupplierAddress(row.address ?? '');
		const had = !!(row.address ?? '').trim();
		setSelectedSupplierHadAddress(had);
		setOpenAllSuppliers(false);
		toast.message('Избран добавувач', { description: row.name });
	};
	// ✅ 1) Ако нема selectedSupplierId, креирај/пронајди (на submit)
	const ensureSupplierExists = async (): Promise<string | null> => {
		const name = supplierName.trim();
		const addr = supplierAddress.trim();
		if (!name) return null;
		// ако веќе е избран, не прави ништо
		if (selectedSupplierId) return selectedSupplierId;
		const { data, error } = await supabase.rpc('suppliers_get_or_create', {
			_name: name,
			_address: addr.length ? addr : null,
		});
		if (error) throw error;
		const row = (Array.isArray(data) ? data[0] : data) as SupplierGetOrCreateRow | null;
		if (!row?.id) throw new Error('Не успеа креирање/наоѓање на добавувач.');
		setSelectedSupplierId(row.id);
		setSupplierName(row.name);
		setSupplierAddress(row.address ?? '');
		setSelectedSupplierHadAddress(!!(row.address ?? '').trim());
		return row.id;
	};
	// ✅ 2) Ако адресата во база била NULL, а корисникот внел адреса -> апдејтирај (на submit)
	const maybeUpdateSupplierAddressOnSave = async (supplierId: string | null) => {
		if (!supplierId) return;
		if (selectedSupplierHadAddress) return;
		const addr = supplierAddress.trim();
		if (!addr) return;
		await new Promise<void>((resolve, reject) => {
			updateAddressMutation.mutate(
				{ supplierId, address: addr },
				{
					onSuccess: () => {
						setSelectedSupplierHadAddress(true);
						resolve();
					},
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
			// 1) ensure supplier exists (create if new)
			const supplierId = await ensureSupplierExists();
			// 2) update address if it was null in DB and user filled it
			await maybeUpdateSupplierAddressOnSave(supplierId);
			// 3) save receive (✅ WITH PAYLOAD HERE)
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
				supplierId,
			};
			await receiveMutation.mutateAsync(payload);
			toast.success('Приемот е успешно зачуван ✅');
			resetAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Грешка при зачувување.');
		}
	};
	return (
		<div className="space-y-5">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold">Прием на стока</h1>
					<button
						type="button"
						onClick={() => {
							setScanError(null);
							setScannerOpen(true);
						}}
						className="mt-3 rounded-3xl bg-blamejaGreen px-8 py-4 text-md font-semibold text-white shadow-sm hover:bg-blamejaGreenDark"
					>
						Скенирај баркод
					</button>
					{scanError && <span className="mt-2 block max-w-[220px] text-[10px] text-blamejaRed">{scanError}</span>}
				</div>
			</div>
			<form
				onSubmit={onSubmit}
				className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
			>
				{/* Документ */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold text-slate-800">Документ</h2>
						<p className="text-[11px] text-slate-500">(сега UI, DB подоцна)</p>
					</div>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-12">
						<div className="md:col-span-3">
							<label className="mb-1 block text-sm font-medium">Број на фактура</label>
							<input
								value={invoiceNo}
								onChange={(e) => setInvoiceNo(e.target.value)}
								className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
								placeholder="пр. 123/2026"
							/>
						</div>
						{/* ✅ Поширок добавувач: col-span-5 */}
						<div className="md:col-span-4">
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
						{/* ✅ Помала адреса: col-span-2 */}
						<div className="md:col-span-3">
							<label className="mb-1 block text-sm font-medium">Адреса (опц.)</label>
							<input
								value={supplierAddress}
								onChange={(e) => setSupplierAddress(e.target.value)}
								className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
								placeholder="ул., место…"
							/>
						</div>
						<div className="md:col-span-2">
							<label className="mb-1 block text-sm font-medium">Датум</label>
							<input
								type="date"
								value={invoiceDate}
								onChange={(e) => setInvoiceDate(e.target.value)}
								className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
							/>
						</div>
						{!selectedSupplierHadAddress && selectedSupplierId && (
							<div className="md:col-span-12">
								<p className="text-[11px] text-slate-500">
									Овој добавувач нема адреса во база. Ако внесеш адреса, ќе се зачува кога ќе кликнеш „Зачувај прием“.
								</p>
							</div>
						)}
					</div>
				</div>
				{/* Category + KPK */}
				<div className="grid grid-cols-1 gap-3 md:grid-cols-12">
					<div className="md:col-span-6">
						<label className="mb-1 block text-sm font-medium">Категорија</label>
						<select
							value={form.categoryId}
							onChange={(e) => {
								form.setCategoryId(e.target.value);
								setSelectedProductId(null);
							}}
							disabled={categoriesQuery.isLoading || !!categoriesQuery.error}
							className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
						>
							<option value="">{categoriesQuery.isLoading ? 'Се вчитува...' : 'Избери категорија'}</option>
							{(categoriesQuery.data ?? []).map((c) => (
								<option
									key={c.id}
									value={c.id}
								>
									{c.name}
								</option>
							))}
						</select>
						{categoriesQuery.error && <p className="mt-1 text-xs text-blamejaRed">Грешка при вчитување категории.</p>}
					</div>
					{isKpk && (
						<div className="md:col-span-6">
							<label className="mb-1 block text-sm font-medium">Фискална шифра (фиксно)</label>
							<input
								value={String(KPK_FISCAL_PLU)}
								readOnly
								className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
							/>
						</div>
					)}
				</div>
				{/* Product */}
				<ProductNameWithSuggestions
					value={form.name}
					onChange={(v) => {
						form.setName(v);
						setSelectedProductId(null);
					}}
					placeholder={form.categoryId ? 'Почни да куцаш (во избрана категорија)…' : 'Почни да куцаш (ќе се пополни категорија)…'}
					loading={choicesQuery.isFetching}
					suggestions={choicesQuery.data ?? []}
					onPick={onPickProduct}
				/>
				{/* ✅ ONE ROW */}
				<div className="grid grid-cols-1 gap-3 md:grid-cols-12">
					<div className="md:col-span-2">
						<label className="mb-1 block text-sm font-medium">
							PLU <span className="text-blamejaRed">*</span>
						</label>
						<input
							value={form.plu}
							onChange={(e) => {
								form.setPlu(e.target.value.replace(/[^\d]/g, ''));
								setSelectedProductId(null);
							}}
							className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blamejaGreen focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30"
							placeholder="пр. 125"
							inputMode="numeric"
						/>
					</div>
					<div className="md:col-span-2">
						<label className="mb-1 block text-sm font-medium">Баркод (опц.)</label>
						<input
							value={form.barcode}
							onChange={(e) => {
								form.setBarcode(e.target.value);
								setSelectedProductId(null);
							}}
							className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blamejaGreen focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30"
							placeholder="3830…"
						/>
					</div>
					<div className="md:col-span-3">
						<label className="mb-1 block text-sm font-medium">ДДВ</label>
						<div className="flex flex-wrap gap-2">
							{(['5', '10', '18'] as const).map((v) => {
								const active = form.taxGroup === v;
								return (
									<button
										key={v}
										type="button"
										onClick={() => {
											form.setTaxGroup(v);
											setSelectedProductId(null);
										}}
										className={[
											'rounded-lg border px-3 py-1.5 text-xs font-semibold',
											active
												? 'border-blamejaGreen bg-blamejaGreen/10 text-slate-900'
												: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
										].join(' ')}
									>
										{v}%
									</button>
								);
							})}
						</div>
					</div>
					<div className="md:col-span-1">
						<label className="mb-1 block text-sm font-medium">Кол.</label>
						<input
							value={form.qty}
							onChange={(e) => form.setQty(e.target.value)}
							className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
							inputMode="decimal"
							placeholder="1"
						/>
					</div>
					<div className="md:col-span-2">
						<label className="mb-1 block text-sm font-medium">Набавна</label>
						<input
							value={form.unitCost}
							onChange={(e) => {
								form.setUnitCost(e.target.value);
								setSelectedProductId(null);
							}}
							className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
							inputMode="decimal"
							placeholder="120"
						/>
					</div>
					<div className="md:col-span-2">
						<label className="mb-1 block text-sm font-medium">Продажна</label>
						<input
							value={form.sellingPrice}
							onChange={(e) => {
								form.setSellingPrice(e.target.value);
								setSelectedProductId(null);
							}}
							className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
							inputMode="decimal"
							placeholder="160"
						/>
					</div>
				</div>
				<div className="mt-4 flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={resetAll}
						className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
					>
						Ресетирај форма
					</button>
					<button
						type="submit"
						disabled={isSubmitDisabled}
						className="rounded-full bg-blamejaGreen px-5 py-2 font-semibold text-white disabled:opacity-60"
					>
						{receiveMutation.isPending ? 'Се зачувува...' : 'Зачувај прием'}
					</button>
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
