'use client';

import { FiCreditCard, FiDollarSign, FiCheck } from 'react-icons/fi';
import type { Totals } from '../types';
import { priceNum, sanitizePriceInput } from '../utils';

type PaymentMethod = 'CASH' | 'CARD';

type Props = {
	totals: Totals;
	busy: boolean;
	cartEmpty: boolean;
	note: string;
	onNoteChange: (v: string) => void;
	paymentMethod: PaymentMethod;
	onPaymentMethodChange: (v: PaymentMethod) => void;
	cashReceivedStr: string;
	onCashReceivedStrChange: (v: string) => void;
	onSubmit: () => void;
};

export const TotalsPanel = ({
	totals,
	busy,
	cartEmpty,
	note,
	onNoteChange,
	onSubmit,
	paymentMethod,
	onPaymentMethodChange,
	cashReceivedStr,
	onCashReceivedStrChange,
}: Props) => {
	const cashNum = priceNum(sanitizePriceInput(cashReceivedStr || '0'));
	const change = Math.max(0, cashNum - totals.total);
	const notEnoughCash =
		paymentMethod === 'CASH' &&
		cashReceivedStr.trim().length > 0 &&
		cashNum < totals.total;

	const submitDisabled =
		busy ||
		cartEmpty ||
		(paymentMethod === 'CASH' && cashNum < totals.total);

	return (
		<div className="flex flex-col gap-4">

			{/* ─── Payment Method ─── */}
			<div>
				<div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
					Начин на плаќање
				</div>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => onPaymentMethodChange('CASH')}
						disabled={busy}
						className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold
							transition-all disabled:opacity-60
							${paymentMethod === 'CASH'
								? 'border-blamejaGreen bg-blamejaGreen text-white shadow-sm'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
							}`}
					>
						<FiDollarSign className="w-4 h-4" />
						Готово
					</button>
					<button
						type="button"
						onClick={() => onPaymentMethodChange('CARD')}
						disabled={busy}
						className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold
							transition-all disabled:opacity-60
							${paymentMethod === 'CARD'
								? 'border-blamejaGreen bg-blamejaGreen text-white shadow-sm'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
							}`}
					>
						<FiCreditCard className="w-4 h-4" />
						Картичка
					</button>
				</div>
			</div>

			{/* ─── Cash received ─── */}
			{paymentMethod === 'CASH' && (
				<div>
					<label
						className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
						htmlFor="totals-cash-received"
					>
						Прима готово (ден.)
					</label>
					<input
						id="totals-cash-received"
						inputMode="decimal"
						value={cashReceivedStr}
						onChange={(e) => onCashReceivedStrChange(sanitizePriceInput(e.target.value))}
						placeholder={totals.total > 0 ? totals.total.toFixed(2) : '0.00'}
						className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors
							focus:ring-2 focus:ring-blamejaGreen/20 focus:border-blamejaGreen
							${notEnoughCash ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
						disabled={busy}
					/>

					<div className={`mt-2 flex items-center justify-between text-sm rounded-lg px-3 py-2
						${notEnoughCash ? 'bg-red-50 border border-red-100' : 'bg-slate-50 border border-slate-100'}`}
					>
						<span className={notEnoughCash ? 'text-red-600 font-medium' : 'text-slate-500'}>
							{notEnoughCash ? `Недоволно (треба ${totals.total.toFixed(2)})` : 'Кусур'}
						</span>
						<span className={`font-bold tabular-nums ${notEnoughCash ? 'text-red-700' : 'text-slate-800'}`}>
							{notEnoughCash ? '—' : `${change.toFixed(2)} ден.`}
						</span>
					</div>
				</div>
			)}

			{/* ─── Totals ─── */}
			<div className="rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
				{totals.discountTotal > 0 && (
					<div className="px-4 py-3 space-y-1.5 border-b border-slate-200">
						<div className="flex items-center justify-between text-sm">
							<span className="text-slate-500">Сума</span>
							<span className="font-semibold text-slate-700 tabular-nums">{totals.subtotal.toFixed(2)} ден.</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-slate-500">Попуст</span>
							<span className="font-semibold text-amber-600 tabular-nums">−{totals.discountTotal.toFixed(2)} ден.</span>
						</div>
					</div>
				)}
				<div className="px-4 py-3 flex items-center justify-between">
					<span className="text-base font-bold text-slate-700">Вкупно за плаќање</span>
					<span className="text-2xl font-extrabold text-slate-900 tabular-nums">{totals.total.toFixed(2)}<span className="text-base font-semibold text-slate-500 ml-1">ден.</span></span>
				</div>
			</div>

			{/* ─── Note ─── */}
			<div>
				<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5" htmlFor="sales-note">
					Забелешка (опц.)
				</label>
				<input
					id="sales-note"
					value={note}
					onChange={(e) => onNoteChange(e.target.value)}
					placeholder="Белешка за продажбата…"
					className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none
						focus:border-blamejaGreen focus:ring-2 focus:ring-blamejaGreen/20"
					disabled={busy}
				/>
			</div>

			{/* ─── Submit CTA ─── */}
			<button
				type="button"
				onClick={onSubmit}
				disabled={submitDisabled}
				className={`w-full flex items-center justify-center gap-2.5 rounded-xl px-4 py-3.5 text-base font-bold
					transition-all
					${submitDisabled
						? 'bg-slate-200 text-slate-400 cursor-not-allowed'
						: 'bg-blamejaGreen text-white hover:bg-blamejaGreenDark shadow-lg shadow-emerald-900/20 hover:shadow-md active:scale-[.99]'
					}`}
			>
				{busy ? (
					<>
						<span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
						Се зачувува...
					</>
				) : (
					<>
						<FiCheck className="w-5 h-5" />
						Зачувај продажба
						<span className="ml-auto flex items-center gap-1 text-white/70">
							<span className="kbd !bg-white/20 !border-white/30 !text-white/90">F9</span>
						</span>
					</>
				)}
			</button>
		</div>
	);
};

export default TotalsPanel;
