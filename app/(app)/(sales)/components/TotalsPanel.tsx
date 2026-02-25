'use client';

import type { Totals } from '../types';
import { priceNum, sanitizePriceInput } from '../utils';

type PaymentMethod = 'CASH' | 'CARD';

type Props = {
	totals: Totals;
	busy: boolean;
	cartEmpty: boolean;

	note: string;
	onNoteChange: (v: string) => void;

	// ✅ new
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
	const notEnoughCash = paymentMethod === 'CASH' && cashReceivedStr.trim().length > 0 && cashNum < totals.total;

	return (
		<div className="space-y-1">
			{/* Payment method */}
			<div>
				<label className="block text-xs font-medium text-slate-600 mb-2">Начин на плаќање</label>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => onPaymentMethodChange('CASH')}
						disabled={busy}
						className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60
								${
									paymentMethod === 'CASH'
										? 'border-blamejaGreen bg-blamejaGreen text-white'
										: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
								}`}
					>
						Готово
					</button>

					<button
						type="button"
						onClick={() => onPaymentMethodChange('CARD')}
						disabled={busy}
						className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60
								${
									paymentMethod === 'CARD'
										? 'border-blamejaGreen bg-blamejaGreen text-white'
										: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
								}`}
					>
						Картичка
					</button>
				</div>

				{/* Cash input */}
				{paymentMethod === 'CASH' && (
					<div className="mt-1">
						<label className="block text-xs font-medium text-slate-600">Дава (ден.)</label>
						<input
							inputMode="decimal"
							value={cashReceivedStr}
							onChange={(e) => onCashReceivedStrChange(sanitizePriceInput(e.target.value))}
							placeholder={totals.total > 0 ? totals.total.toFixed(2) : '0.00'}
							className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
									focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
							disabled={busy}
						/>

						<div className="mt-2 flex items-center justify-between text-sm">
							<span className="text-slate-600">Кусур</span>
							<span className="font-semibold text-slate-900">{change.toFixed(2)} ден.</span>
						</div>

						{notEnoughCash && <div className="mt-1 text-xs text-blamejaRed">Недоволно готово (вкупно {totals.total.toFixed(2)} ден.)</div>}
					</div>
				)}
			</div>

			{/* Note */}
			<div>
				<label className="block text-xs font-medium text-slate-600">Забелешка (опционално)</label>
				<textarea
					value={note}
					onChange={(e) => onNoteChange(e.target.value)}
					rows={3}
					placeholder="Пр. напомена, кој земал, за која намена…"
					className="w-full rounded-lg border border-slate-200 px-3 py-1 text-sm outline-none
							focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
					disabled={busy}
				/>
			</div>

			{/* Totals */}
			<div className="rounded-xl bg-slate-50 border border-slate-200 p-2">
				<div className="flex items-center justify-between text-sm">
					<span className="text-slate-600">Сума</span>
					<span className="font-semibold text-slate-800">{totals.subtotal.toFixed(2)} ден.</span>
				</div>

				<div className="flex items-center justify-between text-sm">
					<span className="text-slate-600">Попуст</span>
					<span className="font-semibold text-slate-800">-{totals.discountTotal.toFixed(2)} ден.</span>
				</div>

				<div className="h-px bg-slate-200 my-3" />

				<div className="flex items-center justify-between">
					<span className="text-slate-700 font-semibold">Вкупно</span>
					<span className="text-2xl font-bold text-slate-900">{totals.total.toFixed(2)} ден.</span>
				</div>
			</div>

			{/* Submit */}
			<button
				type="button"
				onClick={onSubmit}
				disabled={busy || cartEmpty || (paymentMethod === 'CASH' && cashNum < totals.total)}
				className="w-full rounded-lg bg-blamejaGreen px-4 py-3 text-sm font-semibold text-white hover:bg-blamejaGreenDark disabled:opacity-60"
			>
				{busy ? 'Се зачувува...' : 'Зачувај продажба'}
			</button>
		</div>
	);
};

export default TotalsPanel;
