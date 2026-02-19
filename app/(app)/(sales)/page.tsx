"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { supabase } from "app/lib/supabase-client";
import { toast } from "sonner";

type ProductStockRow = {
  product_id: string;
  plu: string | null; // ✅ TEXT
  barcode: string | null;
  name: string | null;
  selling_price: number | null;
  qty_on_hand: number | null;
  category_name: string | null;
};

type CartItem = {
  product: {
    id: string;
    plu: string | null; // ✅ TEXT
    barcode: string | null;
    name: string;
    selling_price: number;
    category_name: string | null;
  };

  qty: number;
  priceStr: string;
  discountPercentStr: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const safeText = (v: unknown) => (typeof v === "string" ? v : "").trim();

const clampPercent = (raw: string) => {
  const s = raw.trim();
  if (s === "") return "";
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return "";
  return String(Math.min(100, Math.max(0, n)));
};

const percentNum = (s: string) => {
  const n = Number.parseInt((s ?? "").trim() || "0", 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

const sanitizePriceInput = (raw: string) => {
  let v = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
  }
  return v;
};

const clampPrice = (raw: string) => {
  const s = raw.trim().replace(",", ".");
  if (s === "") return "";
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return "";
  const fixed = round2(Math.max(0, n));
  return String(fixed);
};

const priceNum = (s: string) => {
  const cleaned = (s ?? "").trim().replace(",", ".");
  const n = Number.parseFloat(cleaned || "0");
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

// ✅ PLU is text, but we treat it as digits-only for matching
const parsePluText = (raw: string) => {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  return t; // keep as string
};

const fetchProductFromStockByExactCode = async (
  code: string
): Promise<ProductStockRow | null> => {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const pluText = parsePluText(trimmed);

  const orParts: string[] = [];
  orParts.push(`barcode.eq.${trimmed}`);
  if (pluText !== null) orParts.push(`plu.eq.${pluText}`); // ✅ string compare

  const { data, error } = await supabase
    .from("product_stock")
    .select("product_id, plu, barcode, name, selling_price, qty_on_hand, category_name")
    .or(orParts.join(","))
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ProductStockRow | null;
};

const searchProducts = async (
  term: string,
  limit = 8
): Promise<ProductStockRow[]> => {
  const t = term.trim();
  if (t.length < 1) return [];

  const pluText = parsePluText(t);

  const baseQuery = supabase
    .from("product_stock")
    .select("product_id, plu, barcode, name, selling_price, qty_on_hand, category_name")
    .or(`barcode.ilike.%${t}%,name.ilike.%${t}%`)
    .order("name", { ascending: true })
    .limit(limit);

  const pluQuery =
    pluText !== null
      ? supabase
          .from("product_stock")
          .select("product_id, plu, barcode, name, selling_price, qty_on_hand, category_name")
          .eq("plu", pluText) // ✅ string compare
          .limit(limit)
      : null;

  const [{ data: baseData, error: baseErr }, pluRes] = await Promise.all([
    baseQuery,
    pluQuery ?? Promise.resolve({ data: [], error: null } as any),
  ]);

  if (baseErr) throw baseErr;
  if (pluRes?.error) throw pluRes.error;

  const combined = [...(baseData ?? []), ...(pluRes?.data ?? [])] as ProductStockRow[];

  const map = new Map<string, ProductStockRow>();
  combined.forEach((r) => map.set(r.product_id, r));
  return Array.from(map.values()).slice(0, limit);
};

const SalesPage = () => {
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // autocomplete
  const [suggestions, setSuggestions] = useState<ProductStockRow[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.qty * priceNum(item.priceStr), 0);

    const discountTotal = cart.reduce((sum, item) => {
      const discPerUnit = priceNum(item.priceStr) * (percentNum(item.discountPercentStr) / 100);
      return sum + item.qty * discPerUnit;
    }, 0);

    const total = subtotal - discountTotal;

    return {
      subtotal: round2(subtotal),
      discountTotal: round2(discountTotal),
      total: round2(total),
    };
  }, [cart]);

  const resetSale = () => {
    setCode("");
    setNote("");
    setCart([]);
    setScanError(null);
    setSuggestions([]);
    setSuggestOpen(false);
  };

  const updateItem = (productId: string, patch: Partial<CartItem>) => {
    setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, ...patch } : i)));
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const changeQty = (productId: string, nextQty: number) => {
    updateItem(productId, { qty: Math.max(1, Math.floor(nextQty || 1)) });
  };

  const addToCartFromRow = async (row: ProductStockRow) => {
    const productId = row.product_id;
    const available = num(row.qty_on_hand);
    const inCart = cart.find((c) => c.product.id === productId)?.qty ?? 0;

    if (available <= inCart) {
      toast.error(`Нема доволно залиха. Достапно: ${available}, во кошничка: ${inCart}.`);
      return;
    }

    const product = {
      id: productId,
      plu: row.plu ?? null,
      barcode: row.barcode ?? null,
      name: safeText(row.name) || "—",
      selling_price: num(row.selling_price),
      category_name: row.category_name ?? null,
    };

    setCart((prev) => {
      const existing = prev.find((p) => p.product.id === productId);
      if (!existing) {
        const base = round2(num(product.selling_price));
        return [
          ...prev,
          {
            product,
            qty: 1,
            priceStr: base > 0 ? String(base) : "",
            discountPercentStr: "",
          },
        ];
      }
      return prev.map((p) => (p.product.id === productId ? { ...p, qty: p.qty + 1 } : p));
    });

    toast.success(`Додадено: ${product.name}`);
  };

  const handleAddByCode = async (codeValue?: string) => {
    const value = (codeValue ?? code).trim();
    if (!value) {
      toast.error("Внеси баркод или PLU.");
      return;
    }

    setBusy(true);
    try {
      const row = await fetchProductFromStockByExactCode(value);

      if (!row) {
        toast.error("Не е пронајден производ со овој баркод/шифра.");
        return;
      }

      await addToCartFromRow(row);
      setCode("");
      setSuggestions([]);
      setSuggestOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Грешка при барање на производ.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      toast.error("Кошничката е празна.");
      return;
    }

    setBusy(true);
    try {
      // validate stock for each item
      for (const item of cart) {
        const { data, error } = await supabase
          .from("product_stock")
          .select("qty_on_hand")
          .eq("product_id", item.product.id)
          .maybeSingle();

        if (error) throw error;

        const available = num((data as any)?.qty_on_hand);
        if (available < item.qty) {
          toast.error(
            `Нема доволно залиха за "${item.product.name}". Достапно: ${available}, бараш: ${item.qty}.`
          );
          setBusy(false);
          return;
        }
      }

      // 1) receipt
      const { data: receipt, error: receiptError } = await supabase
        .from("sales_receipts")
        .insert({
          payment: "OTHER",
          total: totals.total,
        })
        .select("id, receipt_no")
        .single();

      if (receiptError) throw receiptError;

      const receiptId = receipt.id as string;
      const receiptNo = receipt.receipt_no as number;

      // 2) sales_items
      const salesItemsPayload = cart.map((item) => {
        const price = priceNum(item.priceStr);
        const discountPerUnit = price * (percentNum(item.discountPercentStr) / 100);
        return {
          receipt_id: receiptId,
          product_id: item.product.id,
          qty: item.qty,
          price,
          discount: discountPerUnit,
        };
      });

      const { error: salesItemsError } = await supabase.from("sales_items").insert(salesItemsPayload);
      if (salesItemsError) throw salesItemsError;

      // 3) stock movement OUT
      const { data: movement, error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          type: "OUT",
          note: note?.trim() ? note.trim() : `Internal sale #${receiptNo}`,
        })
        .select("id")
        .single();

      if (movementError) throw movementError;

      const movementId = movement.id as string;

      const movementItemsPayload = cart.map((item) => {
        const price = priceNum(item.priceStr);
        const discountPerUnit = price * (percentNum(item.discountPercentStr) / 100);
        const finalUnit = price - discountPerUnit;

        return {
          movement_id: movementId,
          product_id: item.product.id,
          qty: item.qty,
          unit_cost: 0,
          unit_price: finalUnit,
        };
      });

      const { error: movementItemsError } = await supabase
        .from("stock_movement_items")
        .insert(movementItemsPayload);

      if (movementItemsError) throw movementItemsError;

      toast.success(`Продажба зачувана ✅ (Интерно #${receiptNo})`);
      resetSale();
    } catch (e) {
      console.error(e);
      toast.error("Грешка при зачувување на продажбата.");
    } finally {
      setBusy(false);
    }
  };

  const handleScan = (detected: IDetectedBarcode[]) => {
    if (!detected?.length) return;
    const raw = detected[0]?.rawValue ?? "";
    if (!raw) return;

    setScannerOpen(false);
    setScanError(null);

    setCode(raw);
    void handleAddByCode(raw);
  };

  const handleScanError = (err: unknown) => {
    console.error(err);
    setScanError("Грешка при пристап до камерата.");
  };

  // debounce autocomplete search
  useEffect(() => {
    const t = code.trim();

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (t.length < 1) {
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await searchProducts(t, 8);
        setSuggestions(res);
        setSuggestOpen(res.length > 0);
      } catch (e) {
        console.error(e);
        setSuggestions([]);
        setSuggestOpen(false);
      } finally {
        setSuggestLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [code]);

  // close dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-800">Продажба</h1>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setScanError(null);
              setScannerOpen(true);
            }}
            className="rounded-3xl bg-blamejaGreen px-8 py-4 text-md font-semibold text-white shadow-sm hover:bg-blamejaGreenDark disabled:opacity-60"
            disabled={busy}
          >
            Скенирај баркод
          </button>

          {scanError && <p className="text-xs text-blamejaRed">{scanError}</p>}
        </div>
      </div>

      {/* Add line + autocomplete */}
      <div className="rounded-2xl bg-white p-4 md:p-6 shadow-sm border border-slate-200">
        <div ref={wrapRef} className="relative grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Баркод или PLU (или име)
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setSuggestOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAddByCode();
                }
                if (e.key === "Escape") setSuggestOpen(false);
              }}
              placeholder="Скенирај или почни да куцаш…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                         focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
            />

            {(suggestOpen || suggestLoading) && (
              <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="max-h-64 overflow-auto">
                  {suggestLoading && (
                    <div className="px-3 py-2 text-xs text-slate-500">Се пребарува...</div>
                  )}

                  {!suggestLoading && suggestions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-500">Нема резултати.</div>
                  )}

                  {suggestions.map((s) => {
                    const title = safeText(s.name) || "—";
                    const pluText = s.plu != null ? String(s.plu) : "—";
                    const barcodeText = s.barcode ?? "—";
                    const qtyOnHand = num(s.qty_on_hand);

                    return (
                      <button
                        key={s.product_id}
                        type="button"
                        onClick={() => {
                          setSuggestOpen(false);
                          void addToCartFromRow(s);
                          setCode("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">{title}</div>
                            <div className="text-[11px] text-slate-500">
                              PLU: <span className="font-medium">{pluText}</span> • Баркод:{" "}
                              <span className="font-medium">{barcodeText}</span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-[11px] text-slate-500">Залиха</div>
                            <div className="text-sm font-bold text-slate-900">{qtyOnHand}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleAddByCode()}
            disabled={busy}
            className="rounded-lg bg-blamejaOrange px-4 py-2 text-sm font-semibold text-white
                       hover:bg-blamejaOrangeDark disabled:opacity-60"
          >
            {busy ? "..." : "Додај"}
          </button>
        </div>
      </div>

      {/* Cart + Totals + Submit */}
      <div className="rounded-2xl bg-white p-4 md:p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Кошничка</h2>
          <button
            type="button"
            onClick={resetSale}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800"
            disabled={busy}
          >
            Ресет
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="text-sm text-slate-500">
            Нема додадени артикли. Скенирај баркод или избери од листата.
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => {
              const price = priceNum(item.priceStr);
              const discountPerUnit = price * (percentNum(item.discountPercentStr) / 100);
              const finalUnit = price - discountPerUnit;
              const lineTotal = round2(finalUnit * item.qty);

              return (
                <div key={item.product.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{item.product.name}</div>

                      <div className="text-xs text-slate-500">
                        PLU: <span className="font-medium">{item.product.plu ?? "—"}</span>
                        {item.product.barcode ? (
                          <>
                            {" "}
                            • Баркод: <span className="font-medium">{item.product.barcode}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      disabled={busy}
                    >
                      Отстрани
                    </button>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-600">Количина</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => changeQty(item.product.id, Number(e.target.value) || 1)}
                          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                                     focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                        />

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changeQty(item.product.id, item.qty - 1)}
                            className="h-10 w-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            disabled={busy || item.qty <= 1}
                            aria-label="Намали количина"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => changeQty(item.product.id, item.qty + 1)}
                            className="h-10 w-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            disabled={busy}
                            aria-label="Зголеми количина"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600">Цена</label>
                      <input
                        inputMode="decimal"
                        value={item.priceStr}
                        onChange={(e) =>
                          updateItem(item.product.id, { priceStr: sanitizePriceInput(e.target.value) })
                        }
                        onBlur={() => updateItem(item.product.id, { priceStr: clampPrice(item.priceStr) })}
                        placeholder="цена"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                                   focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600">Попуст %</label>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.discountPercentStr}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d]/g, "");
                          updateItem(item.product.id, { discountPercentStr: v });
                        }}
                        onBlur={() =>
                          updateItem(item.product.id, { discountPercentStr: clampPercent(item.discountPercentStr) })
                        }
                        placeholder="попуст"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none
                                   focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600">Вкупно</label>
                      <div className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                        {lineTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="h-px bg-slate-200" />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600">Забелешка (опционално)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
              onClick={() => void handleSubmitSale()}
              disabled={busy || cart.length === 0}
              className="w-full rounded-lg bg-blamejaGreen px-4 py-3 text-sm font-semibold text-white
                         hover:bg-blamejaGreenDark disabled:opacity-60"
            >
              {busy ? "Се зачувува..." : "Зачувај продажба"}
            </button>
          </div>
        </div>
      </div>

      {/* Scanner overlay */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Скенирај баркод / QR</h2>
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="text-sm text-slate-600"
              >
                Затвори ✕
              </button>
            </div>

            <p className="mb-2 text-xs text-slate-500">
              Насочи ја камерата кон етикетата. По читање, производот ќе се додаде во кошничка.
            </p>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Scanner
                onScan={handleScan}
                onError={handleScanError}
                constraints={{ facingMode: "environment" }}
              />
            </div>

            {scanError && <p className="mt-2 text-xs text-blamejaRed">{scanError}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPage;
