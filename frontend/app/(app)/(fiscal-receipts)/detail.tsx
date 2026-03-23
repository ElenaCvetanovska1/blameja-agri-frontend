'use client';

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useFiscalReceiptDetail, type FiscalReceiptItem } from './hooks/useFiscalReceiptDetail';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (dt: string | null | undefined) => {
	if (!dt) return '—';
	return new Date(dt).toLocaleString('mk-MK', { dateStyle: 'medium', timeStyle: 'short' });
};

const mkd = (n: number | null | undefined) => {
	if (n == null) return '—';
	return `${Number(n).toFixed(2)} ден.`;
};

const str = (v: unknown) => (v != null && v !== '' ? String(v) : '—');

// ─── Badges ───────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string | null }) => {
	const map: Record<string, string> = {
		ok:      'bg-green-100 text-green-800',
		failed:  'bg-red-100 text-red-800',
		offline: 'bg-orange-100 text-orange-800',
	};
	const cls = map[status ?? ''] ?? 'bg-slate-100 text-slate-600';
	const label = status === 'ok' ? 'Успешно' : status === 'failed' ? 'Неуспешно' : status === 'offline' ? 'Офлајн' : status ?? '—';
	return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
};

const TypeBadge = ({ type }: { type: string | null }) => {
	const map: Record<string, string> = {
		sale:   'bg-blue-100 text-blue-800',
		storno: 'bg-red-100 text-red-800',
		refund: 'bg-purple-100 text-purple-800',
	};
	const cls = map[type ?? ''] ?? 'bg-slate-100 text-slate-600';
	const label = type === 'sale' ? 'Продажба' : type === 'storno' ? 'Сторно' : type === 'refund' ? 'Поврат' : type ?? '—';
	return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
	<div className="flex flex-col gap-0.5">
		<span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
		<span className="text-sm text-slate-800">{children}</span>
	</div>
);

const ItemsTable = ({ items }: { items: FiscalReceiptItem[] }) => (
	<div className="overflow-x-auto">
		<table className="w-full text-xs">
			<thead>
				<tr className="bg-slate-50 border-b border-slate-100 text-left font-semibold text-slate-500 uppercase tracking-wide">
					<th className="px-3 py-2.5">Производ</th>
					<th className="px-3 py-2.5 text-right">Кол.</th>
					<th className="px-3 py-2.5 text-right">Ед. цена</th>
					<th className="px-3 py-2.5 text-right">Попуст</th>
					<th className="px-3 py-2.5 text-right">Линија</th>
					<th className="px-3 py-2.5 text-center">ДДВ %</th>
					<th className="px-3 py-2.5 text-center">МК</th>
					<th className="px-3 py-2.5">PLU</th>
					<th className="px-3 py-2.5">Фискал PLU</th>
					<th className="px-3 py-2.5">Единица</th>
					<th className="px-3 py-2.5">Баркод</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-slate-100">
				{items.map((item) => (
					<tr key={item.id} className="hover:bg-slate-50 transition-colors">
						<td className="px-3 py-2.5 font-medium text-slate-800 max-w-[200px] truncate" title={item.product_name ?? ''}>
							{item.product_name ?? '—'}
						</td>
						<td className="px-3 py-2.5 text-right text-slate-700">{item.quantity}</td>
						<td className="px-3 py-2.5 text-right whitespace-nowrap">{mkd(item.unit_price)}</td>
						<td className="px-3 py-2.5 text-right whitespace-nowrap">
							{item.discount > 0 ? (
								<span className="text-orange-700">{mkd(item.discount)}</span>
							) : (
								<span className="text-slate-400">—</span>
							)}
						</td>
						<td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-slate-800">
							{mkd(item.line_total)}
						</td>
						<td className="px-3 py-2.5 text-center text-slate-600">
							{item.tax_percent != null ? `${item.tax_percent}%` : item.tax_group != null ? `гр.${item.tax_group}` : '—'}
						</td>
						<td className="px-3 py-2.5 text-center">
							{item.is_macedonian ? (
								<span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">МК</span>
							) : (
								<span className="text-slate-400">—</span>
							)}
						</td>
						<td className="px-3 py-2.5 font-mono text-slate-600">{str(item.plu)}</td>
						<td className="px-3 py-2.5 font-mono text-slate-600">{str(item.fiscal_plu)}</td>
						<td className="px-3 py-2.5 text-slate-600">{str(item.unit)}</td>
						<td className="px-3 py-2.5 font-mono text-slate-500">{str(item.barcode)}</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FiscalReceiptDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [bridgeOpen, setBridgeOpen] = useState(false);

	const query = useFiscalReceiptDetail(id);

	if (query.isLoading) {
		return (
			<div className="flex items-center justify-center py-20 text-sm text-slate-500">
				Се вчитува фискална сметка...
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-4">
				<button type="button" onClick={() => navigate('/fiscal-receipts')} className="text-sm text-blamejaGreen hover:underline">
					← Назад кон листата
				</button>
				<div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-sm text-red-700">
					Грешка при вчитување: {query.error instanceof Error ? query.error.message : 'непозната грешка'}
				</div>
			</div>
		);
	}

	if (!query.data) {
		return (
			<div className="space-y-4">
				<button type="button" onClick={() => navigate('/fiscal-receipts')} className="text-sm text-blamejaGreen hover:underline">
					← Назад кон листата
				</button>
				<div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-sm text-slate-500 text-center">
					Фискалната сметка не е пронајдена.
				</div>
			</div>
		);
	}

	const { receipt, items } = query.data;

	return (
		<div className="space-y-6">
			{/* Back + title */}
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => navigate('/fiscal-receipts')}
						className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
					>
						← Назад
					</button>
					<div>
						<h1 className="text-xl font-bold text-slate-800">
							Фискална сметка {receipt.fiscal_slip_no != null ? `#${receipt.fiscal_slip_no}` : ''}
						</h1>
						<p className="text-xs text-slate-500 mt-0.5">{fmtDate(receipt.fiscalized_at ?? receipt.created_at)}</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<TypeBadge type={receipt.receipt_type} />
					<StatusBadge status={receipt.fiscal_status} />
					{/* STORNO button placeholder — will be wired up in a future task */}
					{receipt.receipt_type === 'sale' && receipt.fiscal_status === 'ok' && (
						<button
							type="button"
							disabled
							title="Сторно ќе биде достапно во следна верзија"
							className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed"
						>
							Сторно (наскоро)
						</button>
					)}
				</div>
			</div>

			{/* Header info card */}
			<div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5">
				<h2 className="mb-4 text-sm font-semibold text-slate-700">Општи информации</h2>
				<div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
					<InfoRow label="Фискален бр.">{receipt.fiscal_slip_no ?? <span className="text-slate-400">—</span>}</InfoRow>
					<InfoRow label="Тип"><TypeBadge type={receipt.receipt_type} /></InfoRow>
					<InfoRow label="Статус"><StatusBadge status={receipt.fiscal_status} /></InfoRow>
					<InfoRow label="Плаќање">
						{receipt.payment === 'CASH' ? 'Готово' : receipt.payment === 'CARD' ? 'Картичка' : str(receipt.payment)}
					</InfoRow>
					<InfoRow label="Продавница">{str(receipt.store_no)}</InfoRow>
					<InfoRow label="Фискализирано">{fmtDate(receipt.fiscalized_at)}</InfoRow>
					<InfoRow label="Создадено">{fmtDate(receipt.created_at)}</InfoRow>
					<InfoRow label="Креирал">{str(receipt.created_by)}</InfoRow>
					<InfoRow label="Вкупно (бруто)">{mkd(receipt.total)}</InfoRow>
					<InfoRow label="Готово дадено">{mkd(receipt.cash_received)}</InfoRow>
					<InfoRow label="Платено">{mkd(receipt.paid_amount)}</InfoRow>
					<InfoRow label="Кусур">{mkd(receipt.change_amount)}</InfoRow>
					{receipt.subtotal != null && (
						<InfoRow label="Меѓузбир">{mkd(receipt.subtotal)}</InfoRow>
					)}
					{receipt.external_doc_no && (
						<InfoRow label="Надворешен документ">{receipt.external_doc_no}</InfoRow>
					)}
					{receipt.sales_receipt_id && (
						<InfoRow label="Апл. сметка (ID)">
							<span className="font-mono text-xs text-slate-600 break-all">{receipt.sales_receipt_id}</span>
						</InfoRow>
					)}
					{receipt.fiscal_error && (
						<div className="col-span-2 sm:col-span-3 lg:col-span-4">
							<InfoRow label="Грешка">
								<span className="text-red-600">{receipt.fiscal_error}</span>
							</InfoRow>
						</div>
					)}
				</div>
			</div>

			{/* Items section */}
			<div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
				<div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
					<h2 className="text-sm font-semibold text-slate-700">
						Ставки{' '}
						<span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
							{items.length}
						</span>
					</h2>
					<span className="text-xs text-slate-500">
						Вкупно:{' '}
						<b className="text-slate-800">
							{mkd(items.reduce((s, i) => s + Number(i.line_total), 0))}
						</b>
					</span>
				</div>

				{items.length === 0 ? (
					<div className="px-6 py-8 text-center text-sm text-slate-500">Нема ставки.</div>
				) : (
					<ItemsTable items={items} />
				)}
			</div>

			{/* Bridge response (collapsible) */}
			{receipt.bridge_response && (
				<div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
					<button
						type="button"
						onClick={() => setBridgeOpen((o) => !o)}
						className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
					>
						<span>Bridge одговор (технички детали)</span>
						<span className="text-slate-400 text-xs">{bridgeOpen ? '▲ Скриј' : '▼ Прикажи'}</span>
					</button>
					{bridgeOpen && (
						<div className="border-t border-slate-100 px-5 py-4">
							<pre className="overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-600 whitespace-pre-wrap break-all">
								{receipt.bridge_response}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
