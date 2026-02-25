// components/DispatchTable.tsx
'use client';

import { useState } from 'react';
import type { DispatchRowVM, ProductSuggestion } from '../types';
import { money, num } from '../utils';
import { useDispatchProductSearch } from '../hooks/useDispatchProductSearch';
import ProductAutocompleteInput from './ProductAutocompleteInput';

type Props = {
  rows: DispatchRowVM[];
  onUpdate: (id: string, patch: any) => void;
  onRemove: (id: string) => void;
};

export const DispatchTable = ({ rows, onUpdate, onRemove }: Props) => {
  const cellInputCls = 'w-full rounded-md border border-slate-200 px-2 py-1 text-sm';

  return (
    <div className="mt-3 rounded-xl border border-slate-200 overflow-x-auto overflow-y-auto max-h-[320px]">
      <table className="min-w-[980px] w-full border-collapse">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="text-[11px] text-slate-600">
            <th className="text-left p-2 border-b border-slate-200 w-[60px]">Ред.</th>
            <th className="text-left p-2 border-b border-slate-200 w-[160px]">Шифра (PLU)</th>
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
            <DispatchRow
              key={r.id}
              r={r}
              cellInputCls={cellInputCls}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DispatchRow = ({
  r,
  cellInputCls,
  onUpdate,
  onRemove,
}: {
  r: DispatchRowVM;
  cellInputCls: string;
  onUpdate: (id: string, patch: any) => void;
  onRemove: (id: string) => void;
}) => {
  // ✅ search for sifra (PLU/barcode)
  const [sifraOpen, setSifraOpen] = useState(false);
  const sifraSearch = useDispatchProductSearch({ term: r.sifra, limit: 8 });

  // ✅ search for naziv (name)
  const [nazivOpen, setNazivOpen] = useState(false);
  const nazivSearch = useDispatchProductSearch({ term: r.naziv, limit: 8 });

  const applySuggestion = (s: ProductSuggestion) => {
  onUpdate(r.id, {
    sifra: s.plu ? s.plu : '',
    naziv: s.name ?? '',
    edinMer: s.unit ?? 'пар',
    cena: Number.isFinite(s.selling_price) ? s.selling_price : 0,
  });
};

  return (
    <tr className="text-sm">
      <td className="p-2 border-b border-slate-100">{r.rb}</td>

      {/* sifra autocomplete */}
      <td className="p-2 border-b border-slate-100">
        <ProductAutocompleteInput
          value={r.sifra}
          onChange={(v) => {
            onUpdate(r.id, { sifra: v });
            setSifraOpen(v.trim().length > 0);
          }}
          placeholder="PLU / баркод…"
          suggestions={sifraSearch.suggestions}
          open={sifraOpen && (sifraSearch.open || sifraSearch.loading)}
          setOpen={setSifraOpen}
          loading={sifraSearch.loading}
          onPick={(s) => applySuggestion(s)}
        />
      </td>

      {/* naziv autocomplete */}
      <td className="p-2 border-b border-slate-100">
        <ProductAutocompleteInput
          value={r.naziv}
          onChange={(v) => {
            onUpdate(r.id, { naziv: v });
            setNazivOpen(v.trim().length > 0);
          }}
          placeholder="Почни да куцаш…"
          suggestions={nazivSearch.suggestions}
          open={nazivOpen && (nazivSearch.open || nazivSearch.loading)}
          setOpen={setNazivOpen}
          loading={nazivSearch.loading}
          onPick={(s) => applySuggestion(s)}
        />
      </td>

      {/* unit */}
      <td className="p-2 border-b border-slate-100">
        <select
          className={cellInputCls}
          value={r.edinMer || ''}
          onChange={(e) => onUpdate(r.id, { edinMer: e.target.value })}
        >
          <option value="">—</option>
          <option value="пар">пар</option>
          <option value="кг">кг</option>
          <option value="м">м</option>
        </select>
      </td>

      {/* qty */}
      <td className="p-2 border-b border-slate-100 text-right">
        <input
          inputMode="decimal"
          className={`${cellInputCls} text-right`}
          value={String(r.kolicina)}
          onChange={(e) => onUpdate(r.id, { kolicina: num(e.target.value) })}
        />
      </td>

      {/* price */}
      <td className="p-2 border-b border-slate-100 text-right">
        <input
          inputMode="decimal"
          placeholder="0.00"
          className={`${cellInputCls} text-right`}
          value={r.cena ? String(r.cena) : ''}
          onChange={(e) => onUpdate(r.id, { cena: num(e.target.value) })}
        />
      </td>

      <td className="p-2 border-b border-slate-100 text-right font-semibold">{money(r.iznos)}</td>

      <td className="p-2 border-b border-slate-100 text-right">
        <button
          type="button"
          onClick={() => onRemove(r.id)}
          className="text-[11px] font-semibold text-blamejaRed hover:underline"
        >
          Избриши
        </button>
      </td>
    </tr>
  );
};

export default DispatchTable;