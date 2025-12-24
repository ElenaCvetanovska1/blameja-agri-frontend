'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStock, type StockRow } from './hooks/useStock';
import { useAdjustStockMutation } from './hooks/useAdjustStockMutation';

const clampQty = (value: string) => {
  const cleaned = value.replace(',', '.');
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return '0';
  return String(num);
};

const fmtQty = (n: number) => {
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0';
};

const parseNum = (v: string) => {
  const n = Number.parseFloat(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

type SortKey = 'NAME' | 'SKU' | 'QTY' | 'CATEGORY';

export default function StockPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StockRow | null>(null);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [qty, setQty] = useState('0'); // target qty (final)
  const [reason, setReason] = useState('');

  // ✅ Filter + sort
  const [categoryFilter, setCategoryFilter] = useState<string>(''); // category_id, "" = all
  const [sortKey, setSortKey] = useState<SortKey>('NAME');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

  const stockQuery = useStock(search);
  const adjustMutation = useAdjustStockMutation();

  const rows = stockQuery.data ?? [];

  const openAdjust = (row: StockRow) => {
    setSelected(row);
    setQty(String(row.qty_on_hand ?? 0));
    setReason('');
    setAdjustOpen(true);
  };

  const closeAdjust = () => {
    setAdjustOpen(false);
    setSelected(null);
  };

  const incQty = (delta: number) => {
    if (!selected) return;
    const current = parseNum(qty);
    const base = Number.isFinite(current) ? current : Number(selected.qty_on_hand ?? 0);
    const next = base + delta;
    setQty(next < 0 ? '0' : String(next));
  };

  const submitAdjust = () => {
    if (!selected) return;

    adjustMutation.mutate(
      {
        productId: selected.product_id,
        targetQty: qty,
        currentQty: Number(selected.qty_on_hand ?? 0),
        reason,
        unitPrice: Number(selected.selling_price ?? 0),
        unitCost: 0,
      },
      {
        onSuccess: () => {
          toast.success('Корекцијата е зачувана ✅');
          closeAdjust();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Грешка при корекција.');
        },
      },
    );
  };

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.is_active).length;
    const outOfStock = rows.filter((r) => (r.qty_on_hand ?? 0) <= 0).length;
    return { total, active, outOfStock };
  }, [rows]);

  // ✅ category options (unique)
  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.category_id && r.category_name) map.set(r.category_id, r.category_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'mk'));
  }, [rows]);

  // ✅ filter + sort on client
  const visibleRows = useMemo(() => {
    let list = [...rows];

    if (categoryFilter) {
      list = list.filter((r) => r.category_id === categoryFilter);
    }

    const dir = sortDir === 'ASC' ? 1 : -1;

    list.sort((a, b) => {
      if (sortKey === 'NAME') {
        return dir * String(a.name ?? '').localeCompare(String(b.name ?? ''), 'mk');
      }
      if (sortKey === 'SKU') {
        return dir * String(a.sku ?? '').localeCompare(String(b.sku ?? ''), 'mk');
      }
      if (sortKey === 'CATEGORY') {
        return dir * String(a.category_name ?? '').localeCompare(String(b.category_name ?? ''), 'mk');
      }
      // QTY
      const qa = Number(a.qty_on_hand ?? 0);
      const qb = Number(b.qty_on_hand ?? 0);
      return dir * (qa - qb);
    });

    return list;
  }, [rows, categoryFilter, sortKey, sortDir]);

  const currentQty = Number(selected?.qty_on_hand ?? 0);
  const targetQtyNum = Number.isFinite(parseNum(qty)) ? parseNum(qty) : NaN;
  const delta = Number.isFinite(targetQtyNum) ? targetQtyNum - currentQty : null;

  return (
    <div className="space-y-5">
      {/* ✅ Title -> paragraph -> then row: left search / right filters (mobile stacked) */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Залиха</h1>
          <p className="mt-1 text-xs text-slate-500">
            Пребарај по SKU, баркод или име. Корекција = внесуваш <b>нова залиха</b>, системот сам прави +/−.
          </p>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Вкупно: <b>{stats.total}</b>
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Активни: <b>{stats.active}</b>
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              залиха: <b>{stats.outOfStock}</b>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {/* LEFT: Search */}
          <div className="w-full sm:max-w-[420px]">
            <label className="block text-xs font-medium text-slate-600">Пребарај</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="пр. SKU-0001, 389..., Тест..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
            />
          </div>

          {/* RIGHT: Filters */}
          <div className="w-full sm:w-[520px] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600">Филтер (категорија)</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Сите категории</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Сортирај по</label>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="NAME">Име</option>
                  <option value="SKU">SKU</option>
                  <option value="QTY">Залиха</option>
                  <option value="CATEGORY">Категорија</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Насока</label>
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as 'ASC' | 'DESC')}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="ASC">Растечки</option>
                  <option value="DESC">Опаѓачки</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="px-3 py-3 text-left">SKU</th>
                <th className="px-3 py-3 text-left">Баркод</th>
                <th className="px-3 py-3 text-left">Име</th>
                <th className="px-3 py-3 text-left">Категорија</th>
                <th className="px-3 py-3 text-left">Подкат.</th>
                <th className="px-3 py-3 text-right">Залиха</th>
                <th className="px-3 py-3 text-right">Продажна</th>
                <th className="px-3 py-3 text-right">Акции</th>
              </tr>
            </thead>

            <tbody>
              {stockQuery.isLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    Се вчитува залиха...
                  </td>
                </tr>
              )}

              {stockQuery.isError && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-red-600">
                    Грешка при вчитување:{' '}
                    {stockQuery.error instanceof Error ? stockQuery.error.message : 'unknown'}
                  </td>
                </tr>
              )}

              {!stockQuery.isLoading && !stockQuery.isError && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    Нема резултати за пребарувањето/филтерите.
                  </td>
                </tr>
              )}

              {visibleRows.map((r) => {
                const qoh = r.qty_on_hand ?? 0;
                const low = qoh > 0 && qoh <= 3;
                const zero = qoh <= 0;

                return (
                  <tr key={r.product_id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{r.sku}</td>
                    <td className="px-3 py-3 text-slate-600">{r.barcode ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-900">{r.name}</td>
                    <td className="px-3 py-3 text-slate-600">{r.category_name ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{r.subcategory_name ?? '—'}</td>

                    <td className="px-3 py-3 text-right">
                      <span
                        className={[
                          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                          zero
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : low
                              ? 'bg-blamejaOrangeSoft text-blamejaOrangeDark border border-amber-100'
                              : 'bg-blamejaGreenSoft text-blamejaGreenDark border border-emerald-100',
                        ].join(' ')}
                      >
                        {fmtQty(qoh)} {r.unit}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-right text-slate-700">
                      {Number(r.selling_price ?? 0).toFixed(2)}
                    </td>

                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openAdjust(r)}
                        className="rounded-full bg-blamejaOrange px-3 py-1.5 text-xs font-semibold text-white hover:bg-blamejaOrangeDark"
                      >
                        Корекција
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adjustOpen && selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Корекција на залиха</div>
                <div className="text-xs text-slate-500">
                  {selected.sku} — {selected.name}
                </div>
              </div>

              <button
                type="button"
                onClick={closeAdjust}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Затвори ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-600">Нова залиха</div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => incQty(-1)}
                    className="h-10 w-10 rounded-full border border-slate-200 hover:bg-slate-50 text-lg"
                  >
                    −
                  </button>

                  <input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onBlur={() => setQty((v) => clampQty(v))}
                    inputMode="decimal"
                    className="h-10 w-28 rounded-xl border border-slate-200 px-3 text-sm text-center
                               focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                  />

                  <button
                    type="button"
                    onClick={() => incQty(+1)}
                    className="h-10 w-10 rounded-full border border-slate-200 hover:bg-slate-50 text-lg"
                  >
                    +
                  </button>

                  <div className="text-xs text-slate-500 ml-2">
                    Моментално: <b>{fmtQty(currentQty)}</b> {selected.unit}
                    {delta !== null && (
                      <>
                        {' '}• Промена:{' '}
                        <b className={delta >= 0 ? 'text-blamejaGreen' : 'text-blamejaRed'}>
                          {delta >= 0 ? '+' : ''}
                          {fmtQty(delta)}
                        </b>
                      </>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-slate-500">
                  Внеси колку <b>треба да биде</b> залихата. Системот сам ќе запише корекција со +/−.
                </p>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-600">Причина</div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="пр. Погрешна количина при прием / корекција..."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={closeAdjust}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Откажи
              </button>

              <button
                type="button"
                onClick={submitAdjust}
                disabled={adjustMutation.isPending}
                className="rounded-full bg-blamejaGreen px-5 py-2 text-xs font-semibold text-white
                           hover:bg-blamejaGreenDark disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {adjustMutation.isPending ? 'Се зачувува...' : 'Зачувај'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
