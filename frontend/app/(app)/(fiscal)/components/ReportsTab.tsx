'use client';

import { useState } from 'react';
import { useFiscalOperations } from '../hooks/useFiscalOperations';

// ─── UI primitives ────────────────────────────────────────────────────────────

const Section = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
	<div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
		<div className="mb-4">
			<div className="text-sm font-semibold text-slate-900">{title}</div>
			{sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
		</div>
		{children}
	</div>
);

const Btn = ({
	onClick,
	disabled,
	variant = 'default',
	children,
}: {
	onClick: () => void;
	disabled?: boolean;
	variant?: 'default' | 'primary' | 'danger' | 'success';
	children: React.ReactNode;
}) => {
	const cls = {
		default: 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
		primary: 'border border-blamejaGreen bg-blamejaGreen text-white hover:brightness-110',
		danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
		success: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
	}[variant];
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${cls}`}
		>
			{children}
		</button>
	);
};

const inputCls =
	'rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50';

// ─── Tab ──────────────────────────────────────────────────────────────────────

export const ReportsTab = () => {
	const { printX, printZ, printFmDate, cashIn, cashOut } = useFiscalOperations();

	const [zConfirm, setZConfirm] = useState(false);
	const [cashAmountStr, setCashAmountStr] = useState('');

	const today = new Date().toISOString().slice(0, 10);
	const [fmFrom, setFmFrom] = useState(today);
	const [fmTo, setFmTo] = useState(today);
	const [fmDetailed, setFmDetailed] = useState(false);

	const cashAmount = Number.parseFloat(cashAmountStr);
	const cashValid = Number.isFinite(cashAmount) && cashAmount > 0;
	const cashBusy = cashIn.isPending || cashOut.isPending;
	const reportBusy = printX.isPending || printZ.isPending || printFmDate.isPending;
	const fmValid = Boolean(fmFrom) && Boolean(fmTo) && fmFrom <= fmTo;

	return (
		<div className="space-y-5">
			{/* Готово влезно / излезно — /cash/in · /cash/out */}
			<Section
				title="Готово влезно / излезно"
				sub="Регистрирај влез или излез на готовина во фискалниот уред (печати потврда)."
			>
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<label
							className="text-xs font-medium text-slate-600"
							htmlFor="fiscal-cash-amount"
						>
							Износ (ден.)
						</label>
						<input
							id="fiscal-cash-amount"
							type="number"
							min="0.01"
							step="0.01"
							placeholder="0.00"
							value={cashAmountStr}
							onChange={(e) => setCashAmountStr(e.target.value)}
							disabled={cashBusy}
							className={`w-40 ${inputCls}`}
						/>
					</div>

					<Btn
						variant="success"
						disabled={cashBusy || !cashValid}
						onClick={() => cashIn.mutate(cashAmount, { onSuccess: () => setCashAmountStr('') })}
					>
						{cashIn.isPending ? 'Обработка...' : 'Готово влезно'}
					</Btn>

					<Btn
						variant="danger"
						disabled={cashBusy || !cashValid}
						onClick={() => cashOut.mutate(cashAmount, { onSuccess: () => setCashAmountStr('') })}
					>
						{cashOut.isPending ? 'Обработка...' : 'Готово излезно'}
					</Btn>
				</div>
			</Section>

			{/* X / Z извештаи — /reports/x · /reports/z */}
			<Section
				title="X и Z извештаи"
				sub="X = контролен преглед без затворање. Z = затворање на ден (неповратно)."
			>
				<div className="flex flex-wrap items-center gap-3">
					<Btn
						onClick={() => printX.mutate()}
						disabled={reportBusy}
					>
						{printX.isPending ? 'Печатење...' : 'X извештај'}
					</Btn>

					{!zConfirm ? (
						<Btn
							onClick={() => setZConfirm(true)}
							disabled={reportBusy}
							variant="danger"
						>
							Z извештај (затвори ден)
						</Btn>
					) : (
						<div className="flex items-center gap-2">
							<span className="text-xs font-semibold text-red-600">Сигурен? Ова го затвора денот — неповратно.</span>
							<Btn
								onClick={() => {
									setZConfirm(false);
									printZ.mutate();
								}}
								disabled={printZ.isPending}
								variant="danger"
							>
								{printZ.isPending ? 'Печатење...' : 'Потврди Z'}
							</Btn>
							<Btn onClick={() => setZConfirm(false)}>Откажи</Btn>
						</div>
					)}
				</div>
			</Section>

			{/* Фискална меморија од дата до дата — /reports/fm-date */}
			<Section
				title="Фискална меморија — извештај од дата до дата"
				sub="Печати извештај од фискалната меморија за избран период (краток или детален)."
			>
				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1">
						<label
							className="text-xs font-medium text-slate-600"
							htmlFor="fm-from"
						>
							Од датум
						</label>
						<input
							id="fm-from"
							type="date"
							value={fmFrom}
							onChange={(e) => setFmFrom(e.target.value)}
							disabled={printFmDate.isPending}
							className={inputCls}
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							className="text-xs font-medium text-slate-600"
							htmlFor="fm-to"
						>
							До датум
						</label>
						<input
							id="fm-to"
							type="date"
							value={fmTo}
							onChange={(e) => setFmTo(e.target.value)}
							disabled={printFmDate.isPending}
							className={inputCls}
						/>
					</div>

					<div className="flex flex-col gap-1">
						<label
							className="text-xs font-medium text-slate-600"
							htmlFor="fm-type"
						>
							Тип
						</label>
						<select
							id="fm-type"
							value={fmDetailed ? '1' : '0'}
							onChange={(e) => setFmDetailed(e.target.value === '1')}
							disabled={printFmDate.isPending}
							className={inputCls}
						>
							<option value="0">Краток</option>
							<option value="1">Детален</option>
						</select>
					</div>

					<Btn
						variant="primary"
						disabled={reportBusy || !fmValid}
						onClick={() => printFmDate.mutate({ from: fmFrom, to: fmTo, detailed: fmDetailed })}
					>
						{printFmDate.isPending ? 'Печатење...' : 'Печати'}
					</Btn>
				</div>
				{!fmValid && fmFrom && fmTo && (
					<p className="mt-2 text-xs font-medium text-red-600">„Од датум“ мора да е пред или еднаков на „До датум“.</p>
				)}
				<p className="mt-3 text-[11px] text-slate-400">
					Извештајот се печати директно на касата — нема дигитален резултат во апликацијата.
				</p>
			</Section>
		</div>
	);
};
