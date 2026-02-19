'use client';

import type { Totals } from '../types';

type Props = {
	totals: Totals;
	busy: boolean;
	cartEmpty: boolean;
	note: string;
	onNoteChange: (v: string) => void;
	onSubmit: () => void;
};

export const TotalsPanel = ({ totals, busy, cartEmpty, note, onNoteChange, onSubmit }: Props) => {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<div className="space-y-2">
				<label className="block text-xs font-medium text-slate-600">Забелешка (опционално)</label>
				<textarea
					value={note}
					onChange={(e) => onNoteChange(e.target.value)}
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
					onClick={onSubmit}
					disabled={busy || cartEmpty}
					className="w-full rounded-lg bg-blamejaGreen px-4 py-3 text-sm font-semibold text-white
                     hover:bg-blamejaGreenDark disabled:opacity-60"
				>
					{busy ? 'Се зачувува...' : 'Зачувај продажба'}
				</button>
			</div>
		</div>
	);
};
