import type { DispatchItem, DocData, ProductLookupRow, ProductSuggestion, Unit } from './types';

export const makeId = () => crypto.randomUUID();

export const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
	return Number.isFinite(n) ? n : 0;
};

export const round2 = (v: number) => Math.round(num(v) * 100) / 100;

const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (v: number) => moneyFmt.format(round2(v));

export const escapeHtml = (s: string) =>
	(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export const downloadTextFile = (content: string, filename: string, mime = 'text/html') => {
	const blob = new Blob([content], { type: `${mime};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

export const blobToDataUrl = (blob: Blob) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('FileReader error'));
		reader.onload = () => resolve(String(reader.result));
		reader.readAsDataURL(blob);
	});

export const normalizeUnit = (v: unknown): Unit => {
	const s = String(v ?? '').trim();
	if (s === 'кг') return 'кг';
	if (s === 'м') return 'м';
	return 'пар';
};

export const normalizeSuggestion = (r: ProductLookupRow): ProductSuggestion => ({
	id: String(r.id),
	plu: (r.plu ?? '').trim(),
	barcode: r.barcode ?? null,
	name: (r.name ?? '—').trim(),
	unit: normalizeUnit(r.unit),
	selling_price: num(r.selling_price),
});

export const makeEmptyItem = (defaults?: Partial<DispatchItem>): DispatchItem => ({
	id: makeId(),

	productId: null,
	sifra: '',
	barcode: null,

	naziv: '',
	edinMer: '',

	kolicina: 1,

	cena: 0,
	prodaznaCena: 0,

	...defaults,
});

export const shouldPrintRow = (it: DispatchItem) => Boolean(it.naziv.trim() || num(it.prodaznaCena) > 0);

// POS-like helpers
export const clampFinalToBase = (finalPrice: number, basePrice: number) => {
	const b = num(basePrice);
	const f = num(finalPrice);
	if (b <= 0) return round2(f);
	return round2(Math.min(f, b));
};

export const discountPerUnitFromBaseFinal = (basePrice: number, finalPrice: number) => {
	const b = num(basePrice);
	const f = num(finalPrice);
	return round2(Math.max(0, b - f));
};

export const buildDispatchHtml = (d: DocData) => {
	const rows = d.items
		.map(
			(r) => `
      <tr>
        <td class="c">${r.rb}</td>
        <td>${escapeHtml(r.sifra)}</td>
        <td>${escapeHtml(r.naziv)}</td>
        <td class="c">${escapeHtml(r.edinMer)}</td>
        <td class="r">${money(r.kolicina)}</td>

        <!-- ЕДИНСТВЕНА ЦЕНА: ПРОДАЖНАТА, ПРИКАЗАНА КАКО "Цена со ДДВ" -->
        <td class="r">${money(r.prodaznaCena)}</td>

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
    .toolbar { display:flex; gap:10px; margin: 0 0 10px 0; }
    .btn { border: 1px solid #111; background: #fff; padding: 10px 14px; border-radius: 999px; font-weight: 800; cursor: pointer; }
    .btn.primary { background: #111; color: #fff; }
    @media print { .wrap { padding: 0; } .toolbar { display: none !important; } }
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
    .totalRow{ margin-top: 6px; display: flex; justify-content: flex-end; }
    .totalBox{ width: 140px; text-align: right; font-size: 14px; font-weight: 800; }
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
            <th style="width:45px;">Ред.</th>
            <th style="width:80px;">Шифра</th>
            <th>Назив на материјалите</th>
            <th style="width:70px;">Един. мер</th>
            <th style="width:80px;">Количина</th>

            <!-- НОВА ЕДНА КОЛОНА ЗА ЦЕНА -->
            <th style="width:110px;">Цена со ДДВ</th>

            <th style="width:110px;">Износ (ден.)</th>
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
