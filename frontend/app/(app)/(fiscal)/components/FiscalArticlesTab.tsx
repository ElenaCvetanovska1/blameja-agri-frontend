'use client';

import { useState } from 'react';
import { type FiscalArticle, VAT_GROUP_LABELS, fiscalErrorMessage } from 'app/lib/fiscal-bridge';
import { useFiscalArticles } from '../hooks/useFiscalArticles';

// ─── UI helpers ───────────────────────────────────────────────────────────────

const ErrorPanel = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
	<div className="rounded-xl border border-red-200 bg-red-50 p-4">
		<div className="text-xs font-semibold text-red-700">Грешка при комуникација со касата</div>
		<div className="mt-1 break-words text-xs text-red-600">{fiscalErrorMessage(error)}</div>
		{onRetry && (
			<button
				type="button"
				onClick={onRetry}
				className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
			>
				Обиди се повторно
			</button>
		)}
	</div>
);

const cellInput =
	'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blamejaGreen disabled:opacity-50';

type VatGroup = 'A' | 'B' | 'V' | 'G';
const VAT_OPTIONS: VatGroup[] = ['A', 'B', 'V', 'G'];

const VatSelect = ({
	value,
	onChange,
	disabled,
	id,
}: {
	value: string;
	onChange: (v: VatGroup) => void;
	disabled?: boolean;
	id?: string;
}) => (
	<select
		id={id}
		value={value}
		onChange={(e) => onChange(e.target.value as VatGroup)}
		disabled={disabled}
		className={cellInput}
	>
		{VAT_OPTIONS.map((g) => (
			<option
				key={g}
				value={g}
			>
				{VAT_GROUP_LABELS[g]}
			</option>
		))}
	</select>
);

type RowEdit = { name: string; priceStr: string; vatGroup: VatGroup };

// ─── Додади нов артикал (компактен ред) ───────────────────────────────────────

const AddArticleRow = () => {
	const { program, readOne } = useFiscalArticles();
	const [pluStr, setPluStr] = useState('');
	const [name, setName] = useState('');
	const [priceStr, setPriceStr] = useState('');
	const [vatGroup, setVatGroup] = useState<VatGroup>('B');
	/** Постоечки артикал на тој PLU (жива проверка од касата) — бара експлицитна потврда за препис. */
	const [overwrite, setOverwrite] = useState<FiscalArticle | null>(null);

	const plu = Number.parseInt(pluStr, 10);
	const price = Number.parseFloat(priceStr);
	const valid = Number.isInteger(plu) && plu > 0 && name.trim().length > 0 && Number.isFinite(price) && price >= 0;

	const doProgram = () => {
		program.mutate(
			{ plu, name: name.trim(), price, vatGroup },
			{
				onSuccess: () => {
					setPluStr('');
					setName('');
					setPriceStr('');
					setOverwrite(null);
				},
			},
		);
	};

	/**
	 * БЕЗБЕДНОСНА ПРОВЕРКА: пред додавање се чита PLU директно од касата (не од кеширана листа).
	 * Ако е веќе програмиран → предупредување со постоечките податоци + експлицитна потврда.
	 * Ако читањето не успее → НЕ програмираме слепо.
	 */
	const handleAdd = async () => {
		if (!valid) return;
		try {
			const existing = await readOne.mutateAsync(plu);
			if (existing.programmed) {
				setOverwrite(existing);
				return;
			}
		} catch {
			// Грешката е веќе прикажана (toast од readOne) — не продолжуваме без потврда од касата.
			return;
		}
		doProgram();
	};

	const busy = readOne.isPending || program.isPending;

	return (
		<div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
			<div className="mb-2 text-xs font-semibold text-slate-600">Додади нов артикал во касата</div>
			<div className="flex flex-wrap items-end gap-2">
				<div className="w-24">
					<label
						htmlFor="new-plu"
						className="mb-1 block text-[11px] text-slate-500"
					>
						PLU
					</label>
					<input
						id="new-plu"
						type="number"
						min="1"
						placeholder="PLU"
						value={pluStr}
						onChange={(e) => {
							setPluStr(e.target.value);
							setOverwrite(null);
						}}
						disabled={busy}
						className={cellInput}
					/>
				</div>
				<div className="min-w-[180px] flex-1">
					<label
						htmlFor="new-name"
						className="mb-1 block text-[11px] text-slate-500"
					>
						Име (до 20 знаци)
					</label>
					<input
						id="new-name"
						type="text"
						maxLength={20}
						placeholder="нпр. РОБА"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={cellInput}
					/>
				</div>
				<div className="w-28">
					<label
						htmlFor="new-price"
						className="mb-1 block text-[11px] text-slate-500"
					>
						Цена (ден.)
					</label>
					<input
						id="new-price"
						type="number"
						min="0"
						step="0.01"
						placeholder="0.00"
						value={priceStr}
						onChange={(e) => setPriceStr(e.target.value)}
						className={cellInput}
					/>
				</div>
				<div className="w-28">
					<label
						htmlFor="new-vat"
						className="mb-1 block text-[11px] text-slate-500"
					>
						ДДВ
					</label>
					<VatSelect
						id="new-vat"
						value={vatGroup}
						onChange={setVatGroup}
					/>
				</div>
				<button
					type="button"
					disabled={!valid || busy}
					onClick={() => void handleAdd()}
					className="rounded-lg border border-blamejaGreen bg-blamejaGreen px-4 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
				>
					{readOne.isPending ? 'Проверка во касата...' : program.isPending ? 'Запишување...' : 'Додади'}
				</button>
			</div>

			{/* Предупредување: PLU веќе постои во касата */}
			{overwrite && (
				<div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
					<div className="text-xs font-semibold text-red-700">⚠ PLU {overwrite.plu} ВЕЌЕ ПОСТОИ во касата!</div>
					<div className="mt-1 text-xs text-red-600">
						Постоечки артикал: <strong>{overwrite.name || '—'}</strong> · {overwrite.price.toFixed(2)} ден. ·{' '}
						{VAT_GROUP_LABELS[overwrite.vatGroup] ?? overwrite.vatGroup}. Ако продолжиш, ќе биде <strong>ПРЕПИШАН</strong> со: „
						{name.trim()}“ · {Number.isFinite(price) ? price.toFixed(2) : '—'} ден. · {VAT_GROUP_LABELS[vatGroup]}.
					</div>
					<div className="mt-2 flex gap-2">
						<button
							type="button"
							disabled={program.isPending}
							onClick={doProgram}
							className="rounded-lg border border-red-300 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
						>
							{program.isPending ? 'Запишување...' : 'Препиши го'}
						</button>
						<button
							type="button"
							onClick={() => setOverwrite(null)}
							className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
						>
							Откажи
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

// ─── Tab ──────────────────────────────────────────────────────────────────────

export const FiscalArticlesTab = () => {
	const { list, program, remove } = useFiscalArticles();
	const [edits, setEdits] = useState<Record<number, RowEdit>>({});
	const [confirmPlu, setConfirmPlu] = useState<number | null>(null);

	const articles: FiscalArticle[] = list.data ?? [];

	const getEdit = (a: FiscalArticle): RowEdit =>
		edits[a.plu] ?? { name: a.name, priceStr: a.price.toFixed(2), vatGroup: (a.vatGroup as VatGroup) ?? 'B' };

	const setEdit = (plu: number, patch: Partial<RowEdit>, base: RowEdit) => setEdits((prev) => ({ ...prev, [plu]: { ...base, ...patch } }));

	const isDirty = (a: FiscalArticle): boolean => {
		const e = edits[a.plu];
		if (!e) return false;
		const price = Number.parseFloat(e.priceStr);
		return e.name.trim() !== a.name || (Number.isFinite(price) && Math.abs(price - a.price) > 0.004) || e.vatGroup !== a.vatGroup;
	};

	const isValidEdit = (e: RowEdit): boolean => {
		const price = Number.parseFloat(e.priceStr);
		return e.name.trim().length > 0 && Number.isFinite(price) && price >= 0;
	};

	const saveRow = (a: FiscalArticle) => {
		const e = getEdit(a);
		if (!isValidEdit(e)) return;
		program.mutate(
			{ plu: a.plu, name: e.name.trim(), price: Number.parseFloat(e.priceStr), vatGroup: e.vatGroup },
			{
				onSuccess: () =>
					setEdits((prev) => {
						const next = { ...prev };
						delete next[a.plu];
						return next;
					}),
			},
		);
	};

	return (
		<div className="space-y-4">
			<div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className="text-sm font-semibold text-slate-900">
							Програмирани артикли во касата{list.isSuccess ? ` (${articles.length})` : ''}
						</div>
						<div className="mt-0.5 text-xs text-slate-500">
							Измени Име/Цена/ДДВ директно во табелата и кликни „Зачувај“ — записот се ажурира ВО фискалната меморија.
						</div>
					</div>
					<button
						type="button"
						onClick={() => void list.refetch()}
						disabled={list.isFetching}
						className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
					>
						{list.isFetching ? 'Читање од касата...' : 'Освежи'}
					</button>
				</div>

				<div className="mb-4">
					<AddArticleRow />
				</div>

				{list.isPending && <div className="py-8 text-center text-sm text-slate-500">Се вчитуваат артиклите од касата...</div>}

				{list.isError && (
					<ErrorPanel
						error={list.error}
						onRetry={() => void list.refetch()}
					/>
				)}

				{list.isSuccess && articles.length === 0 && (
					<div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
						Нема програмирани артикли во касата.
					</div>
				)}

				{list.isSuccess && articles.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[760px] text-sm">
							<thead className="bg-slate-50 text-xs text-slate-600">
								<tr>
									<th className="px-3 py-2 text-left w-20">PLU</th>
									<th className="px-3 py-2 text-left">Име</th>
									<th className="px-3 py-2 text-left w-32">Цена (ден.)</th>
									<th className="px-3 py-2 text-left w-32">ДДВ</th>
									<th className="px-3 py-2 text-right w-24">Залиха</th>
									<th className="px-3 py-2 text-right w-52">Акција</th>
								</tr>
							</thead>
							<tbody>
								{articles.map((a) => {
									const e = getEdit(a);
									const dirty = isDirty(a);
									const savingThis = program.isPending && program.variables?.plu === a.plu;
									const deletingThis = remove.isPending && remove.variables === a.plu;
									const busyRow = savingThis || deletingThis;
									return (
										<tr
											key={a.plu}
											className={`border-t border-slate-100 transition ${dirty ? 'bg-amber-50/60' : 'hover:bg-slate-50/50'}`}
										>
											<td className="px-3 py-2 font-mono font-semibold text-slate-900">{a.plu}</td>
											<td className="px-3 py-2">
												<input
													type="text"
													maxLength={20}
													value={e.name}
													disabled={busyRow}
													onChange={(ev) => setEdit(a.plu, { name: ev.target.value }, e)}
													className={cellInput}
													aria-label={`Име за PLU ${a.plu}`}
												/>
											</td>
											<td className="px-3 py-2">
												<input
													type="number"
													min="0"
													step="0.01"
													value={e.priceStr}
													disabled={busyRow}
													onChange={(ev) => setEdit(a.plu, { priceStr: ev.target.value }, e)}
													className={cellInput}
													aria-label={`Цена за PLU ${a.plu}`}
												/>
											</td>
											<td className="px-3 py-2">
												<VatSelect
													value={e.vatGroup}
													disabled={busyRow}
													onChange={(v) => setEdit(a.plu, { vatGroup: v }, e)}
												/>
											</td>
											<td className="px-3 py-2 text-right font-mono text-xs text-slate-500">{a.quantity}</td>
											<td className="px-3 py-2 text-right">
												<span className="inline-flex items-center gap-1.5">
													{dirty && (
														<button
															type="button"
															disabled={busyRow || !isValidEdit(e)}
															onClick={() => saveRow(a)}
															className="rounded-lg border border-blamejaGreen bg-blamejaGreen px-3 py-1 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
														>
															{savingThis ? 'Запишување...' : 'Зачувај'}
														</button>
													)}
													{dirty && !savingThis && (
														<button
															type="button"
															onClick={() =>
																setEdits((prev) => {
																	const next = { ...prev };
																	delete next[a.plu];
																	return next;
																})
															}
															className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition"
														>
															Врати
														</button>
													)}
													{confirmPlu === a.plu ? (
														<>
															<span className="text-[11px] font-semibold text-red-600">Сигурен?</span>
															<button
																type="button"
																disabled={busyRow}
																onClick={() => {
																	setConfirmPlu(null);
																	remove.mutate(a.plu);
																}}
																className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50"
															>
																{deletingThis ? 'Бришење...' : 'Потврди'}
															</button>
															<button
																type="button"
																onClick={() => setConfirmPlu(null)}
																className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition"
															>
																Откажи
															</button>
														</>
													) : (
														<button
															type="button"
															disabled={remove.isPending}
															onClick={() => setConfirmPlu(a.plu)}
															className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
														>
															Избриши
														</button>
													)}
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				<p className="mt-3 text-[11px] text-slate-400">
					Редовите со измени се обележани жолто. Читањето/запишувањето оди преку сериска врска — може да потрае.
				</p>
			</div>
		</div>
	);
};
