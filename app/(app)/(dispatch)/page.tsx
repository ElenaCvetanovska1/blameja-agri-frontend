'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Item = {
	id: string;
	sifra: string;
	naziv: string;
	edinMer: string;
	kolicina: number;
	cena: number;
};

type DocData = {
	docNo: string;
	docDate: string;

	// фирма
	logoDataUrl?: string; // base64 data URL
	firmaNaziv: string;
	firmaAdresa: string;
	firmaTelefon: string;
	firmaTransSmetka: string;

	// купувач
	kupuvac: string;
	adresa: string;

	items: Array<{
		rb: number;
		sifra: string;
		naziv: string;
		edinMer: string;
		kolicina: number;
		cena: number;
		iznos: number;
	}>;
	total: number;
};

const makeId = () => crypto.randomUUID();
const todayISO = () => new Date().toISOString().slice(0, 10);

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
	return Number.isFinite(n) ? n : 0;
};

// 1,234.00
const moneyFmt = new Intl.NumberFormat('en-US', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
const money = (v: number) => moneyFmt.format(Math.round(v * 100) / 100);

const escapeHtml = (s: string) =>
	(s ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');

const downloadTextFile = (content: string, filename: string, mime = 'text/html') => {
	const blob = new Blob([content], { type: `${mime};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

const blobToDataUrl = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('FileReader error'));
		reader.onload = () => resolve(String(reader.result));
		reader.readAsDataURL(blob);
	});

const buildIspratnicaHtml = (d: DocData) => {
	const rows = d.items
		.map(
			(r) => `
      <tr>
        <td class="c">${r.rb}</td>
        <td>${escapeHtml(r.sifra)}</td>
        <td>${escapeHtml(r.naziv)}</td>
        <td class="c">${escapeHtml(r.edinMer)}</td>
        <td class="r">${money(r.kolicina)}</td>
        <td class="r">${money(r.cena)}</td>
        <td class="r">${money(r.iznos)}</td>
      </tr>
    `,
		)
		.join('');

	const logoHtml = d.logoDataUrl ? `<img class="logo" src="${d.logoDataUrl}" alt="logo" />` : '';

	return `<!doctype html>
<html lang="mk">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Испратница бр. ${escapeHtml(d.docNo)}</title>
  <style>
    @page { size: A4; margin: 12mm; }

    body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 0; }
    .wrap { padding: 12mm; }
    .sheet { width: 100%; }

    .toolbar { display:flex; gap:10px; margin: 0 0 10px 0; }
    .btn {
      border: 1px solid #111;
      background: #fff;
      padding: 10px 14px;
      border-radius: 999px;
      font-weight: 800;
      cursor: pointer;
    }
    .btn.primary { background: #111; color: #fff; }

    @media print {
      .wrap { padding: 0; }
      .toolbar { display: none !important; }
    }

    .top { display:flex; justify-content:space-between; gap: 16px; align-items:flex-start; }
    .brand { display:flex; gap: 12px; align-items:flex-start; }
    .logo { width: 90px; height: 90px; object-fit: contain; }

    .firm { font-size: 12px; line-height: 1.3; }
    .firm .name { font-size: 18px; font-weight: 900; letter-spacing: .4px; }
    .muted { opacity: .9; }

    .box { border: 1px solid #111; padding: 10px; min-width: 280px; }
    .row { display:flex; gap:10px; margin: 6px 0; }
    .lbl { min-width: 76px; font-weight: 800; }
    .val { flex:1; border-bottom: 1px solid #111; padding-bottom: 2px; }

    .mid { margin-top: 14px; display:flex; justify-content:space-between; align-items:flex-end; }
    .title { font-size: 26px; font-weight: 900; letter-spacing: 1px; }

    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #111; padding: 6px 8px; font-size: 12px; }
    th { background: #f3f3f3; text-align: center; font-weight: 900; }
    .c { text-align: center; }
    .r { text-align: right; }

    /* TOTAL aligned to last column width (110px) */
    .totalRow{
      margin-top: 6px;
      display: flex;
      justify-content: flex-end;
    }
    .totalBox{
      width: 110px; /* same as last column */
      text-align: right;
      font-size: 14px;
      font-weight: 800;
    }

    .footer { margin-top: 18px; display:flex; justify-content:space-between; gap: 20px; }
    .sign { width: 46%; }
    .sign .label { font-weight: 900; }
    .sign .line { border-bottom: 1px solid #111; height: 22px; margin-top: 18px; }
    .sign .cap { font-size: 12px; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="toolbar">
      <button class="btn primary" onclick="window.print()">Печати</button>
    </div>

    <div class="sheet">
      <div class="top">
        <div class="brand">
          ${logoHtml}
          <div class="firm">
            <div class="name">${escapeHtml(d.firmaNaziv)}</div>
            <div class="muted">${escapeHtml(d.firmaAdresa)}</div>
            ${d.firmaTelefon ? `<div class="muted">Тел: ${escapeHtml(d.firmaTelefon)}</div>` : ``}
            ${d.firmaTransSmetka ? `<div class="muted">Транс. сметка: ${escapeHtml(d.firmaTransSmetka)}</div>` : ``}
          </div>
        </div>

        <div class="box">
          <div class="row"><div class="lbl">Купувач</div><div class="val">${escapeHtml(d.kupuvac)}</div></div>
          <div class="row"><div class="lbl">Адреса</div><div class="val">${escapeHtml(d.adresa)}</div></div>
          <div class="row"><div class="lbl">Датум</div><div class="val">${escapeHtml(d.docDate)}</div></div>
        </div>
      </div>

      <div class="mid">
        <div class="title">ИСПРАТНИЦА бр. ${escapeHtml(d.docNo)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:50px;">Ред.</th>
            <th style="width:90px;">Шифра</th>
            <th>Назив на материјалите</th>
            <th style="width:90px;">Един. мер</th>
            <th style="width:90px;">Количина</th>
            <th style="width:90px;">Цена со ДДВ</th>
            <th style="width:110px;">Износ со ДДВ (ден.)</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="7" class="c">Нема ставки</td></tr>`}
        </tbody>
      </table>

      <div class="totalRow">
        <div class="totalBox">Вкупно: ${money(d.total)}</div>
      </div>

      <div class="footer">
        <div class="sign">
          <div class="label">Издал:</div>
          <div class="line"></div>
          <div class="cap">потпис</div>
        </div>
        <div class="sign" style="text-align:right;">
          <div class="label">Примил:</div>
          <div class="line"></div>
          <div class="cap">потпис</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const makeEmptyItem = (defaults?: Partial<Item>): Item => ({
	id: makeId(),
	sifra: '',
	naziv: '',
	edinMer: '',
	kolicina: 1,
	cena: 0,
	...defaults,
});

// print row only if naziv or cena > 0
const shouldPrintRow = (it: Item) => Boolean(it.naziv.trim() || num(it.cena) > 0);

export default function DispatchPage() {
	// HARD-CODE фирма
	const firmaNaziv = 'БЛАМЕЈА';
	const firmaAdresa = 'ул. 8-ми Септември бр. 69, Битола';
	const firmaTelefon = '047/221-398';
	const firmaTransSmetka = '270065696840148 (Халк банка)';

	const [docNo, setDocNo] = useState('1');
	const [docDate, setDocDate] = useState(todayISO());
	const [kupuvac, setKupuvac] = useState('');
	const [adresa, setAdresa] = useState('');

	// Default 4 rows
	const [items, setItems] = useState<Item[]>([
		makeEmptyItem(),
		makeEmptyItem(),
		makeEmptyItem(),
		makeEmptyItem(),
	]);

	const rows = useMemo(() => {
		return items.map((it, idx) => {
			const iznos = num(it.kolicina) * num(it.cena);
			return { ...it, rb: idx + 1, iznos };
		});
	}, [items]);

	const printableRows = useMemo(() => items.filter(shouldPrintRow), [items]);
	const totalPrintable = useMemo(
		() => printableRows.reduce((s, it) => s + num(it.kolicina) * num(it.cena), 0),
		[printableRows],
	);

	const updateItem = (id: string, patch: Partial<Item>) => {
		setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
	};

	const addRow = () => setItems((prev) => [...prev, makeEmptyItem()]);

	const removeRow = (id: string) => {
		setItems((prev) => {
			const next = prev.filter((x) => x.id !== id);
			while (next.length < 4) next.push(makeEmptyItem());
			return next;
		});
	};

	const validate = () => {
		if (!docNo.trim()) return 'Внеси број на испратница.';
		if (!kupuvac.trim()) return 'Внеси купувач.';
		if (!adresa.trim()) return 'Внеси адреса.';
		if (printableRows.length === 0) return 'Внеси барем една ставка (назив или цена).';
		if (printableRows.some((r) => num(r.kolicina) <= 0)) return 'Количината мора да е > 0 за пополнетите редови.';
		return null;
	};

	const handleDownloadDocument = async () => {
		const err = validate();
		if (err) return toast.error(err);

		let logoDataUrl: string | undefined;
		try {
			const res = await fetch('/blamejaLogo.png', { cache: 'no-store' });
			if (res.ok) {
				const blob = await res.blob();
				logoDataUrl = await blobToDataUrl(blob);
			}
		} catch {
			// ignore
		}

		const printable = printableRows.map((it, idx) => {
			const k = num(it.kolicina);
			const c = num(it.cena);
			return {
				rb: idx + 1,
				sifra: it.sifra,
				naziv: it.naziv,
				edinMer: it.edinMer,
				kolicina: k,
				cena: c,
				iznos: k * c,
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

		const html = buildIspratnicaHtml(doc);
		downloadTextFile(html, `ispratnica-${doc.docNo}.html`);
		toast.success('Превземено. Отвори → “Печати” → исклучи “Headers and footers”.');
	};

	// UI classes
	const labelCls = 'text-[11px] font-semibold text-slate-600';
	const inputCls = 'mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm';
	const cellInputCls = 'w-full rounded-md border border-slate-200 px-2 py-1 text-sm';

	return (
		<div className="max-w-6xl mx-auto flex flex-col gap-3">
			<h1 className="text-xl font-bold text-slate-800">Испратница</h1>

			{/* ONE RECTANGLE FOR EVERYTHING */}
			<div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
				{/* TOP INPUTS */}
				<div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
					<div className="md:col-span-2">
						<label className={labelCls}>Бр. Испратница</label>
						<input className={inputCls} value={docNo} onChange={(e) => setDocNo(e.target.value)} />
					</div>

					<div className="md:col-span-2">
						<label className={labelCls}>Датум</label>
						<input type="date" className={inputCls} value={docDate} onChange={(e) => setDocDate(e.target.value)} />
					</div>

					<div className="md:col-span-4">
						<label className={labelCls}>Купувач</label>
						<input className={inputCls} value={kupuvac} onChange={(e) => setKupuvac(e.target.value)} placeholder="Пр. Раде" />
					</div>

					<div className="md:col-span-4">
						<label className={labelCls}>Адреса</label>
						<input className={inputCls} value={adresa} onChange={(e) => setAdresa(e.target.value)} placeholder="Пр. Битола" />
					</div>
				</div>

				{/* spacer */}
				<div className="mt-4 border-t border-slate-200" />

				{/* TABLE with scroll after ~6 rows */}
				<div className="mt-3 rounded-xl border border-slate-200 overflow-x-auto overflow-y-auto max-h-[320px]">
					<table className="min-w-[980px] w-full border-collapse">
						<thead className="sticky top-0 bg-white z-10">
							<tr className="text-[11px] text-slate-600">
								<th className="text-left p-2 border-b border-slate-200 w-[60px]">Ред.</th>
								<th className="text-left p-2 border-b border-slate-200 w-[120px]">Шифра</th>
								<th className="text-left p-2 border-b border-slate-200">Назив</th>
								<th className="text-left p-2 border-b border-slate-200 w-[120px]">Един. мер</th>
								<th className="text-right p-2 border-b border-slate-200 w-[120px]">Количина</th>
								<th className="text-right p-2 border-b border-slate-200 w-[120px]">Цена</th>
								<th className="text-right p-2 border-b border-slate-200 w-[140px]">Износ</th>
								<th className="p-2 border-b border-slate-200 w-[80px]" />
							</tr>
						</thead>

						<tbody>
							{rows.map((r) => (
								<tr key={r.id} className="text-sm">
									<td className="p-2 border-b border-slate-100">{r.rb}</td>

									<td className="p-2 border-b border-slate-100">
										<input className={cellInputCls} value={r.sifra} onChange={(e) => updateItem(r.id, { sifra: e.target.value })} />
									</td>

									<td className="p-2 border-b border-slate-100">
										<input className={cellInputCls} value={r.naziv} onChange={(e) => updateItem(r.id, { naziv: e.target.value })} />
									</td>

									<td className="p-2 border-b border-slate-100">
										<input className={cellInputCls} value={r.edinMer} onChange={(e) => updateItem(r.id, { edinMer: e.target.value })} />
									</td>

									<td className="p-2 border-b border-slate-100 text-right">
										<input
											inputMode="decimal"
											className={`${cellInputCls} text-right`}
											value={String(r.kolicina)}
											onChange={(e) => updateItem(r.id, { kolicina: num(e.target.value) })}
										/>
									</td>

									<td className="p-2 border-b border-slate-100 text-right">
										<input
											inputMode="decimal"
											placeholder="0.00"
											className={`${cellInputCls} text-right`}
											value={r.cena ? String(r.cena) : ''}
											onChange={(e) => updateItem(r.id, { cena: num(e.target.value) })}
										/>
									</td>

									<td className="p-2 border-b border-slate-100 text-right font-semibold">{money(r.iznos)}</td>

									<td className="p-2 border-b border-slate-100 text-right">
										<button
											type="button"
											onClick={() => removeRow(r.id)}
											className="text-[11px] font-semibold text-blamejaRed hover:underline"
										>
											Избриши
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* bottom bar */}
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