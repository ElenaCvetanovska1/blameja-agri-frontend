'use client';

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useFiscalReceiptDetail, type FiscalReceiptItem } from './hooks/useFiscalReceiptDetail';
import { useStornoFlow } from './hooks/useStornoFlow';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mkd = (n: number | null | undefined) => {
	if (n == null) return '—';
	return `${Number(n).toFixed(2)} ден.`;
};

// ─── Step types ───────────────────────────────────────────────────────────────

type SelectionMap = Record<string, { checked: boolean; qty: string }>;
type Step = 'select' | 'review' | 'processing' | 'done';

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
	<div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
		<div className="px-5 py-4 border-b border-slate-100">
			<h2 className="text-sm font-semibold text-slate-700">{title}</h2>
		</div>
		<div className="p-5">{children}</div>
	</div>
);

// ─── Item selection table ─────────────────────────────────────────────────────

const SelectionTable = ({
	items,
	selection,
	onChange,
}: {
	items: FiscalReceiptItem[];
	selection: SelectionMap;
	onChange: (id: string, field: 'checked' | 'qty', value: boolean | string) => void;
}) => (
	<div className="overflow-x-auto">
		<table className="w-full text-xs">
			<thead>
				<tr className="bg-slate-50 border-b border-slate-100 text-left text-slate-500 font-semibold uppercase tracking-wide">
					<th className="px-3 py-2.5 w-8" />
					<th className="px-3 py-2.5">Производ</th>
					<th className="px-3 py-2.5 text-right">Ед. цена</th>
					<th className="px-3 py-2.5 text-right">Оригинал</th>
					<th className="px-3 py-2.5 text-right">Веќе вратено</th>
					<th className="px-3 py-2.5 text-right">Преостанато</th>
					<th className="px-3 py-2.5 text-right w-28">Враќам кол.</th>
					<th className="px-3 py-2.5 text-right">Сума</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-slate-100">
				{items.map((item) => {
					const alreadyReturned = item.quantity - item.remaining_qty;
					const sel = selection[item.id] ?? { checked: false, qty: '0' };
					const qtyNum = Number(sel.qty) || 0;
					const lineAmt = item.unit_price * qtyNum;
					const canReturn = item.remaining_qty > 0;

					return (
						<tr
							key={item.id}
							className={`transition-colors ${canReturn ? 'hover:bg-slate-50' : 'opacity-40'}`}
						>
							<td className="px-3 py-2.5 text-center">
								<input
									type="checkbox"
									disabled={!canReturn}
									checked={sel.checked}
									onChange={(e) => onChange(item.id, 'checked', e.target.checked)}
									className="h-4 w-4 rounded border-slate-300 text-blamejaGreen accent-blamejaGreen"
								/>
							</td>
							<td
								className="px-3 py-2.5 font-medium text-slate-800 max-w-[200px] truncate"
								title={item.product_name ?? ''}
							>
								{item.product_name ?? '—'}
							</td>
							<td className="px-3 py-2.5 text-right whitespace-nowrap">{mkd(item.unit_price)}</td>
							<td className="px-3 py-2.5 text-right text-slate-600">{item.quantity}</td>
							<td className="px-3 py-2.5 text-right text-orange-600">
								{alreadyReturned > 0 ? alreadyReturned : <span className="text-slate-400">—</span>}
							</td>
							<td className="px-3 py-2.5 text-right font-semibold text-slate-800">{item.remaining_qty}</td>
							<td className="px-3 py-2.5 text-right">
								<input
									type="number"
									min="0"
									max={item.remaining_qty}
									step="1"
									disabled={!canReturn || !sel.checked}
									value={sel.checked ? sel.qty : ''}
									onChange={(e) => onChange(item.id, 'qty', e.target.value)}
									className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs disabled:opacity-40 focus:border-blamejaGreen focus:outline-none"
								/>
							</td>
							<td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-slate-800">
								{sel.checked && qtyNum > 0 ? mkd(lineAmt) : <span className="text-slate-400">—</span>}
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	</div>
);

// ─── Review table ─────────────────────────────────────────────────────────────

const ReviewTable = ({ lines }: { lines: Array<{ name: string | null; qty: number; unitPrice: number }> }) => (
	<table className="w-full text-xs">
		<thead>
			<tr className="bg-slate-50 border-b border-slate-100 text-left text-slate-500 font-semibold uppercase tracking-wide">
				<th className="px-3 py-2.5">Производ</th>
				<th className="px-3 py-2.5 text-right">Кол.</th>
				<th className="px-3 py-2.5 text-right">Ед. цена</th>
				<th className="px-3 py-2.5 text-right">Сума</th>
			</tr>
		</thead>
		<tbody className="divide-y divide-slate-100">
			{lines.map((line, i) => (
				<tr
					key={i}
					className="hover:bg-slate-50"
				>
					<td className="px-3 py-2 font-medium text-slate-800">{line.name ?? '—'}</td>
					<td className="px-3 py-2 text-right text-slate-700">{line.qty}</td>
					<td className="px-3 py-2 text-right whitespace-nowrap">{mkd(line.unitPrice)}</td>
					<td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{mkd(line.unitPrice * line.qty)}</td>
				</tr>
			))}
		</tbody>
	</table>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StornoPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { runStornoFlow } = useStornoFlow();

	const query = useFiscalReceiptDetail(id);
	const [step, setStep] = useState<Step>('select');
	const [selection, setSelection] = useState<SelectionMap>({});
	const [error, setError] = useState<string | null>(null);

	// ── Loading / Error / Not-found guards ────────────────────────────────────

	if (query.isLoading) {
		return <div className="flex items-center justify-center py-20 text-sm text-slate-500">Се вчитува фискална сметка...</div>;
	}

	if (query.isError || !query.data) {
		return (
			<div className="space-y-4">
				<button
					type="button"
					onClick={() => navigate(`/fiscal-receipts/${id}`)}
					className="text-sm text-blamejaGreen hover:underline"
				>
					← Назад
				</button>
				<div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-sm text-red-700">Грешка при вчитување на фискална сметка.</div>
			</div>
		);
	}

	const { receipt, items } = query.data;

	// ── Eligibility check ────────────────────────────────────────────────────

	if (receipt.receipt_type !== 'sale' || receipt.fiscal_status !== 'success') {
		return (
			<div className="space-y-4">
				<button
					type="button"
					onClick={() => navigate(`/fiscal-receipts/${id}`)}
					className="text-sm text-blamejaGreen hover:underline"
				>
					← Назад
				</button>
				<div className="rounded-2xl bg-orange-50 border border-orange-200 p-6 text-sm text-orange-700">
					Оваа сметка не е подобна за сторно. Само успешно фискализирани продажби можат да се сторнираат.
				</div>
			</div>
		);
	}

	const eligibleItems = items.filter((i) => i.remaining_qty > 0);

	if (eligibleItems.length === 0 && step === 'select') {
		return (
			<div className="space-y-4">
				<button
					type="button"
					onClick={() => navigate(`/fiscal-receipts/${id}`)}
					className="text-sm text-blamejaGreen hover:underline"
				>
					← Назад
				</button>
				<div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-sm text-slate-500 text-center">
					Сите ставки од оваа сметка се веќе сторнирани.
				</div>
			</div>
		);
	}

	// ── Selection helpers ────────────────────────────────────────────────────

	const handleSelectionChange = (itemId: string, field: 'checked' | 'qty', value: boolean | string) => {
		setSelection((prev) => {
			const current = prev[itemId] ?? { checked: false, qty: '1' };
			if (field === 'checked') {
				const item = items.find((i) => i.id === itemId);
				return {
					...prev,
					[itemId]: {
						checked: value as boolean,
						qty: (value as boolean) ? String(item?.remaining_qty ?? 1) : current.qty,
					},
				};
			}
			return { ...prev, [itemId]: { ...current, qty: value as string } };
		});
	};

	// Build selected lines for review
	const selectedLines = items
		.filter((item) => selection[item.id]?.checked)
		.map((item) => {
			const qty = Number(selection[item.id]?.qty) || 0;
			return {
				originalItemId: item.id,
				name: item.product_name,
				qty,
				unitPrice: item.unit_price,
				taxGroup: item.tax_group,
				isMacedonian: item.is_macedonian,
			};
		})
		.filter((line) => line.qty > 0);

	const stornoTotal = selectedLines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

	// Validation for proceeding from select to review
	const validationError = (): string | null => {
		if (selectedLines.length === 0) return 'Изберете барем една ставка за враќање.';
		for (const line of selectedLines) {
			const item = items.find((i) => i.id === line.originalItemId);
			if (!item) continue;
			if (line.qty > item.remaining_qty)
				return `Количината за "${item.product_name}" (${line.qty}) надминува расположивото (${item.remaining_qty}).`;
		}
		return null;
	};

	const paymentMethod = (receipt.payment === 'CARD' ? 'CARD' : 'CASH') as 'CASH' | 'CARD';

	// ── Confirm handler ───────────────────────────────────────────────────────

	const handleConfirm = async () => {
		setStep('processing');
		setError(null);
		try {
			const flowItems = selectedLines.map((l) => ({
				originalItemId: l.originalItemId,
				quantity: l.qty,
				productName: l.name,
				unitPrice: l.unitPrice,
				taxGroup: l.taxGroup,
				isMacedonian: l.isMacedonian,
			}));

			const result = await runStornoFlow({
				originalReceiptId: id!,
				items: flowItems,
				total: stornoTotal,
				payment: paymentMethod,
				storeNo: receipt.store_no,
				createdBy: receipt.created_by,
			});

			navigate(`/fiscal-receipts/${result.stornoReceiptId}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setStep('review');
		}
	};

	// ─────────────────────────────────────────────────────────────────────────

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-3 flex-wrap">
				<button
					type="button"
					onClick={() => (step === 'select' ? navigate(`/fiscal-receipts/${id}`) : setStep('select'))}
					className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
					disabled={step === 'processing'}
				>
					← Назад
				</button>
				<div>
					<h1 className="text-xl font-bold text-slate-800">Сторно на сметка #{receipt.fiscal_slip_no ?? id?.slice(0, 8)}</h1>
					<p className="text-xs text-slate-500 mt-0.5">
						{step === 'select' && 'Изберете ставки и количини за враќање'}
						{step === 'review' && 'Прегледајте го сторното пред потврда'}
						{step === 'processing' && 'Се извршува сторно...'}
					</p>
				</div>
			</div>

			{/* ── STEP: select ─────────────────────────────────────────────────── */}
			{step === 'select' && (
				<>
					<SectionCard title="Изберете ставки за враќање">
						<SelectionTable
							items={items}
							selection={selection}
							onChange={handleSelectionChange}
						/>
					</SectionCard>

					{selectedLines.length > 0 && (
						<div className="flex items-center justify-between rounded-2xl bg-orange-50 border border-orange-200 px-5 py-4">
							<span className="text-sm font-medium text-orange-800">
								Вкупно за враќање: <b className="text-lg">{mkd(stornoTotal)}</b>
							</span>
							<button
								type="button"
								onClick={() => {
									const err = validationError();
									if (err) {
										setError(err);
										return;
									}
									setError(null);
									setStep('review');
								}}
								className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
							>
								Прегледај →
							</button>
						</div>
					)}

					{error && <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-3 text-sm text-red-700">{error}</div>}
				</>
			)}

			{/* ── STEP: review ─────────────────────────────────────────────────── */}
			{step === 'review' && (
				<>
					<SectionCard title="Преглед на сторно">
						<ReviewTable lines={selectedLines.map((l) => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice }))} />
					</SectionCard>

					<div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5 space-y-3">
						<div className="flex items-center justify-between text-sm">
							<span className="text-slate-600">Вкупно за враќање</span>
							<b className="text-lg text-slate-800">{mkd(stornoTotal)}</b>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-slate-600">Начин на враќање</span>
							<span className="text-slate-800">{paymentMethod === 'CASH' ? 'Готово' : 'Картичка'}</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-slate-600">Ставки за враќање</span>
							<span className="text-slate-800">{selectedLines.length}</span>
						</div>
					</div>

					<div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 space-y-1">
						<p className="font-semibold">Внимание — оваа акција не може да се поништи!</p>
						<p>Со потврда ќе се испечати физички сторно фискален сметка на уредот. Проверете дека количините се точни.</p>
					</div>

					{error && <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-3 text-sm text-red-700">{error}</div>}

					<div className="flex items-center gap-3 justify-end">
						<button
							type="button"
							onClick={() => setStep('select')}
							className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
						>
							← Назад
						</button>
						<button
							type="button"
							onClick={handleConfirm}
							className="rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
						>
							Потврди Сторно
						</button>
					</div>
				</>
			)}

			{/* ── STEP: processing ─────────────────────────────────────────────── */}
			{step === 'processing' && (
				<div className="flex flex-col items-center justify-center gap-4 py-20">
					<div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blamejaGreen" />
					<p className="text-sm text-slate-600">Се извршува сторно на фискален уред...</p>
					<p className="text-xs text-slate-400">Не ја затворајте оваа страница.</p>
				</div>
			)}
		</div>
	);
}
