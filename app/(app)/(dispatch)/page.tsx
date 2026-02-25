// page.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import type { BuyerRow, DocData } from './types';
import { blobToDataUrl, buildIspratnicaHtml, downloadTextFile, money, num } from './utils';

import { useDispatchItems } from './hooks/useDispatchItems';
import DispatchTable from './components/DispatchTable';

import BuyerInputWithSuggestions from './components/BuyerInputWithSuggestions';
import { useBuyerAll } from './hooks/useBuyerChoices';

export default function DispatchPage() {
	// HARD-CODE фирма
	const firmaNaziv = 'БЛАМЕЈА';
	const firmaAdresa = 'ул. 8-ми Септември бр. 69, Битола';
	const firmaTelefon = '047/221-398';
	const firmaTransSmetka = '270065696840148 (Халк банка)';

	const [docNo, setDocNo] = useState('1');
	const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));

	const [kupuvac, setKupuvac] = useState('');
	const [adresa, setAdresa] = useState('');

	// ✅ ќе го палиме кога првпат ќе се фокусира купувачот
	const [buyersEnabled, setBuyersEnabled] = useState(false);
	const buyersQuery = useBuyerAll(buyersEnabled);
	const allBuyers = buyersQuery.data ?? [];

	const { rows, printableRows, totalPrintable, updateItem, addRow, removeRow } = useDispatchItems();

	const onPickBuyer = (row: BuyerRow) => {
		setKupuvac(row.name ?? '');
		setAdresa(row.address ?? ''); // ако нема -> празно
		toast.message('Избран купувач', { description: row.name });
	};

	const validate = () => {
		if (!docNo.trim()) return 'Внеси број на испратница.';
		if (!kupuvac.trim()) return 'Внеси купувач.';
		if (!adresa.trim()) return 'Внеси адреса.';
		if (printableRows.length === 0) return 'Внеси барем една ставка (назив или продажна цена).';
		if (printableRows.some((r) => num(r.kolicina) <= 0)) return 'Количината мора да е > 0 за пополнетите редови.';
		return null;
	};

	const handleDownloadDocument = async () => {
		const err = validate();
		if (err) return toast.error(err);

		let logoDataUrl: string | undefined;
		try {
			const res = await fetch('/blamejaLogo.png', { cache: 'no-store' });
			if (res.ok) logoDataUrl = await blobToDataUrl(await res.blob());
		} catch {
			// ignore
		}

		const printable = printableRows.map((it, idx) => {
			const k = num(it.kolicina);
			const fixed = num(it.cena);
			const sell = num(it.prodaznaCena);

			return {
				rb: idx + 1,
				sifra: it.sifra,
				naziv: it.naziv,
				edinMer: it.edinMer || '',
				kolicina: k,

				cena: fixed, // фиксна
				prodaznaCena: sell, // продажна

				iznos: k * sell, // ✅ пресметка по продажна цена
			};
		});

		const doc: DocData = {
			docNo: docNo.trim(),
			docDate: docDate.trim(),
			logoDataUrl,
			firmaNaziv,
			firmaAdresa,
			firmaTelefon,
			firmaTransSmetka,
			kupuvac: kupuvac.trim(),
			adresa: adresa.trim(),
			items: printable,
			total: printable.reduce((s, r) => s + num(r.iznos), 0),
		};

		downloadTextFile(buildIspratnicaHtml(doc), `ispratnica-${doc.docNo}.html`);
		toast.success('Превземено. Отвори → “Печати” → исклучи “Headers and footers”.');
	};

	const labelCls = 'text-[11px] font-semibold text-slate-600';
	const inputCls = 'w-full rounded-lg border border-slate-200 px-2 py-2 text-sm';

	return (
		<div className="max-w-6xl mx-auto flex flex-col gap-3">
			<h1 className="text-xl font-bold text-slate-800">Испратница</h1>

			<div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
				<div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
					<div className="md:col-span-2">
						<label className={labelCls}>Бр. Испратница</label>
						<input
							className={inputCls}
							value={docNo}
							onChange={(e) => setDocNo(e.target.value)}
						/>
					</div>

					<div className="md:col-span-2">
						<label className={labelCls}>Датум</label>
						<input
							type="date"
							className={inputCls}
							value={docDate}
							onChange={(e) => setDocDate(e.target.value)}
						/>
					</div>

					<div className="md:col-span-4">
						<div
							onFocusCapture={() => setBuyersEnabled(true)}
							onClickCapture={() => setBuyersEnabled(true)}
						>
							<BuyerInputWithSuggestions
								value={kupuvac}
								onChange={setKupuvac}
								onPick={onPickBuyer}
								all={allBuyers}
								loading={buyersQuery.isFetching}
								placeholder="Купувач…"
								hint="Кликни за листа, или куцај за филтер."
							/>
						</div>
					</div>

					<div className="md:col-span-4">
						<label className={labelCls}>Адреса</label>
						<input
							className={inputCls}
							value={adresa}
							onChange={(e) => setAdresa(e.target.value)}
							placeholder="Адреса…"
						/>
					</div>
				</div>

				<div className="mt-4 border-t border-slate-200" />

				<DispatchTable
					rows={rows}
					onUpdate={updateItem}
					onRemove={removeRow}
				/>

				<div className="mt-4 flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={addRow}
						className="rounded-2xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
					>
						+ Додај ред
					</button>

					<div className="ml-auto flex items-center gap-4">
						<div className="text-sm font-semibold text-slate-700">
							Вкупно: <span className="font-bold text-slate-900">{money(totalPrintable)} ден.</span>
						</div>

						<button
							type="button"
							onClick={handleDownloadDocument}
							className="rounded-2xl bg-blamejaGreen px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blamejaGreenDark"
						>
							Зачувај / Превземи
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
