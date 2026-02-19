"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { toast } from "sonner";
import { supabase } from "app/lib/supabase-client";

import { useReceiveMutation } from "./hooks/useReceiveMutation";

/** ---------- Types ---------- */
type CategoryRow = { id: string; name: string; code: string };

type ProductChoiceRow = {
  product_id: string;
  name: string | null;
  plu: string | null; // ✅ TEXT
  barcode: string | null;
  selling_price: number | null;
  tax_group: number | null;
  category_id: string | null;
  category_name: string | null;
};

const KPK_CODE = "kpk";
const KPK_FISCAL_PLU = 80;

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseNumOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed.replace(",", "."));
  if (Number.isNaN(n)) return undefined;
  return n;
};

const ReceivePage = () => {
  // required
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");

  // identifiers
  const [plu, setPlu] = useState(""); // ✅ text PLU
  const [barcode, setBarcode] = useState("");

  // optional
  const [sellingPrice, setSellingPrice] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [details, setDetails] = useState("");

  // qty required
  const [qty, setQty] = useState("1");

  // tax
  const [taxGroup, setTaxGroup] = useState<"5" | "10" | "18">("5");

  // scanner
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // autocomplete
  const [suggestions, setSuggestions] = useState<ProductChoiceRow[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  /** ---------- Load categories ---------- */
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setCatLoading(true);
      setCatError(null);
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("id, name, code")
          .order("name", { ascending: true });

        if (error) throw error;
        if (!mounted) return;
        setCategories((data ?? []) as CategoryRow[]);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setCatError("Грешка при вчитување категории.");
      } finally {
        if (mounted) setCatLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId]
  );

  const isKpk = useMemo(() => {
    return (selectedCategory?.code ?? "").toLowerCase() === KPK_CODE;
  }, [selectedCategory]);

  /** ---------- Receive mutation (hook) ---------- */
  const receiveMutation = useReceiveMutation({
    plu,
    barcode,
    name,
    sellingPrice,
    qty,
    unitCost,
    description: details,
    note: details,
    categoryId,
    taxGroup,
  });

  /** ---------- Autocomplete fetch via RPC ---------- */
  const fetchChoices = async (q: string) => {
    const term = q.trim();
    const _q = term.length ? term : null;
    const _category_id = categoryId.trim() ? categoryId.trim() : null;

    const { data, error } = await supabase.rpc("product_choices_search", {
      _category_id,
      _q,
      _limit: 10,
    });

    if (error) throw error;
    return (data ?? []) as ProductChoiceRow[];
  };

  // debounce search by name
  useEffect(() => {
    const t = name.trim();

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
        const rows = await fetchChoices(t);
        setSuggestions(rows);
        setSuggestOpen(rows.length > 0);
      } catch (e) {
        console.error(e);
        setSuggestions([]);
        setSuggestOpen(false);
      } finally {
        setSuggestLoading(false);
      }
    }, 220);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [name, categoryId]);

  // outside click closes dropdown
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pickSuggestion = (row: ProductChoiceRow) => {
    setSelectedProductId(row.product_id);

    const pickedName = (row.name ?? "").trim();
    setName(pickedName);

    if (row.category_id) setCategoryId(row.category_id);

    // ✅ auto-fill (PLU is TEXT)
    setPlu((row.plu ?? "").trim());
    setBarcode(row.barcode ?? "");
    setSellingPrice(row.selling_price === null ? "" : String(num(row.selling_price)));

    const tg = String(Math.trunc(num(row.tax_group))) as "5" | "10" | "18";
    if (tg === "5" || tg === "10" || tg === "18") setTaxGroup(tg);

    setSuggestOpen(false);
    setSuggestions([]);
    toast.success("Избран производ ✅");
  };

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (!detectedCodes?.length) return;
    const raw = detectedCodes[0]?.rawValue ?? "";
    if (!raw) return;

    setBarcode(raw);
    setScanError(null);
    setIsScannerOpen(false);
    toast.message("Скенирано", { description: raw });
  };

  const handleScanError = (err: unknown) => {
    console.error("Scanner error:", err);
    setScanError("Настана грешка при пристап до камерата.");
  };

  const resetForm = () => {
    setCategoryId("");
    setName("");
    setPlu("");
    setBarcode("");
    setSellingPrice("");
    setUnitCost("");
    setDetails("");
    setQty("1");
    setTaxGroup("18");
    setSelectedProductId(null);
    setSuggestions([]);
    setSuggestOpen(false);
    setScanError(null);
    setIsScannerOpen(false);
  };

  const isFormValid = useMemo(() => {
    const n = name.trim();
    const cat = categoryId.trim();
    if (!n) return false;
    if (!cat) return false;

    // PLU mandatory (digits-only check is in hook)
    if (!plu.trim()) return false;

    const q = parseNumOrNull(qty);
    if (q === undefined || q === null || q <= 0) return false;

    const sp = parseNumOrNull(sellingPrice);
    if (sp === undefined) return false;

    const uc = parseNumOrNull(unitCost);
    if (uc === undefined) return false;

    return true;
  }, [name, categoryId, qty, plu, sellingPrice, unitCost]);

  const isSubmitDisabled =
    receiveMutation.isPending || catLoading || !!catError || !isFormValid;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    receiveMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Приемот е успешно зачуван ✅");
        resetForm();
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Грешка при прием."),
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Прием на стока</h1>

          <button
            type="button"
            onClick={() => {
              setScanError(null);
              setIsScannerOpen(true);
            }}
            className="mt-3 rounded-3xl bg-blamejaGreen px-8 py-4 text-md font-semibold text-white shadow-sm hover:bg-blamejaGreenDark"
          >
            Скенирај баркод
          </button>

          {scanError && (
            <span className="mt-2 block max-w-[220px] text-[10px] text-blamejaRed">
              {scanError}
            </span>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200"
      >
        {/* Category */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Категорија</label>

          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSelectedProductId(null);
            }}
            disabled={catLoading || !!catError}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">
              {catLoading ? "Се вчитува..." : "Избери категорија"}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {catError && <p className="text-xs text-blamejaRed">{catError}</p>}
        </div>

        {/* Fiscal PLU (only for KPK) */}
        {isKpk && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Фискална шифра (фиксно)
            </label>
            <input
              value={String(KPK_FISCAL_PLU)}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            />
            <p className="text-[11px] text-slate-500">
              За „Систем капка по капка“ сите артикли се сумираат на фискална под
              шифра {KPK_FISCAL_PLU}.
            </p>
          </div>
        )}

        {/* Name (mandatory) with autocomplete */}
        <div ref={wrapRef} className="relative space-y-2">
          <label className="block text-sm font-medium">
            Име на производ <span className="text-blamejaRed">*</span>
          </label>

          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSelectedProductId(null);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setSuggestOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSuggestOpen(false);
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
            placeholder={
              categoryId
                ? "Почни да куцаш (ќе пребарува во избраната категорија)…"
                : "Почни да куцаш (ќе се пополни категорија кога ќе избереш)…"
            }
          />

          {(suggestOpen || suggestLoading) && (
            <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="max-h-64 overflow-auto">
                {suggestLoading && (
                  <div className="px-3 py-2 text-xs text-slate-500">
                    Се пребарува...
                  </div>
                )}

                {!suggestLoading && suggestions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-500">
                    Нема резултати.
                  </div>
                )}

                {suggestions.map((s) => {
                  const title = (s.name ?? "—").trim();
                  const pluText = (s.plu ?? "—").toString();
                  const barcodeText = s.barcode ?? "—";
                  const cat = s.category_name ?? "—";

                  return (
                    <button
                      key={s.product_id}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            PLU: <span className="font-medium">{pluText}</span>{" "}
                            • Баркод:{" "}
                            <span className="font-medium">{barcodeText}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {cat}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[11px] text-slate-500">Цена</div>
                          <div className="text-sm font-bold text-slate-900">
                            {num(s.selling_price).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Ако избереш постоечки производ, системот ќе пополни PLU/баркод/цена/ДДВ.
            Ако внесуваш нов производ: избери категорија, внеси име и PLU.
          </p>
        </div>

        {/* PLU + Barcode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              PLU <span className="text-blamejaRed">*</span>
            </label>
            <input
              value={plu}
              onChange={(e) => {
                // digits only, still TEXT
                setPlu(e.target.value.replace(/[^\d]/g, ""));
                setSelectedProductId(null);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
              placeholder="пр. 125"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Баркод (опц.)</label>
            <input
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                setSelectedProductId(null);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
              placeholder="3830..."
            />
          </div>

          <p className="md:col-span-2 text-[11px] text-slate-500">
            * PLU е задолжителен. Баркод е опционален.
          </p>
        </div>

        {/* Tax */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">ДДВ (tax group)</label>
          <div className="grid grid-cols-3 gap-2">
            {(["5", "10", "18"] as const).map((v) => {
              const active = taxGroup === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setTaxGroup(v);
                    setSelectedProductId(null);
                  }}
                  className={[
                    "rounded-xl border px-4 py-2 text-sm font-semibold",
                    active
                      ? "border-blamejaGreen bg-blamejaGreen/10 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {v}%
                </button>
              );
            })}
          </div>
        </div>

        {/* Qty + prices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Количина</label>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Набавна (опц.)</label>
            <input
              value={unitCost}
              onChange={(e) => {
                setUnitCost(e.target.value);
                setSelectedProductId(null);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
              placeholder="пр. 120"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Продажна (опц.)</label>
            <input
              value={sellingPrice}
              onChange={(e) => {
                setSellingPrice(e.target.value);
                setSelectedProductId(null);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
              placeholder="пр. 160"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Опис / Забелешка (опц.)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[110px]"
            placeholder="Пр. активна материја, дозирање, добавувач, број на фактура..."
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ресетирај форма
          </button>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="px-5 py-2 rounded-full bg-blamejaGreen text-white font-semibold disabled:opacity-60"
          >
            {receiveMutation.isPending ? "Се зачувува..." : "Зачувај прием"}
          </button>
        </div>

        {receiveMutation.isError && (
          <p className="text-blamejaRed text-sm">
            {(receiveMutation.error as Error).message}
          </p>
        )}
      </form>

      {/* Scanner overlay */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Скенирај баркод</h2>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="text-sm text-slate-600"
              >
                Затвори ✕
              </button>
            </div>

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

export default ReceivePage;
