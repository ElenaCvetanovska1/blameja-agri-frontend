// components/ProductAutocompleteInput.tsx
'use client';

import { useEffect, useRef } from 'react';
import type { ProductSuggestion } from '../types';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;

  suggestions: ProductSuggestion[];
  open: boolean;
  setOpen: (v: boolean) => void;
  loading: boolean;

  onPick: (s: ProductSuggestion) => void;
};

export const ProductAutocompleteInput = ({
  value,
  onChange,
  placeholder,
  disabled,
  suggestions,
  open,
  setOpen,
  loading,
  onPick,
}: Props) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [setOpen]);

  const show = open && (loading || suggestions.length > 0);

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value.trim().length > 0) setOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
      />

      {show && (
        <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="max-h-34 overflow-auto">
            {loading && <div className="px-3 py-2 text-xs text-slate-500">Се пребарува...</div>}

            {!loading && suggestions.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Нема резултати.</div>}

            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep focus
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{s.name}</div>
                    <div className="text-[11px] text-slate-500">
                      PLU: <span className="font-medium">{s.plu || '—'}</span>
                      {s.barcode ? (
                        <>
                          {' '}• Баркод: <span className="font-medium">{s.barcode}</span>
                        </>
                      ) : null}
                      {' '}• {s.unit}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[11px] text-slate-500">Цена</div>
                    <div className="text-sm font-bold text-slate-900">{Number(s.selling_price).toFixed(2)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductAutocompleteInput;