"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { toast } from "sonner";

import { useCategoryTree } from "./hooks/useCategoryTree";
import { useReceiveMutation } from "./hooks/useReceiveMutation";
import { useStockLookup, type StockLookupRow } from "./hooks/useStockLookup";

/** Custom dropdown што се отвора НАДОЛУ + max height + scroll */
type CategorySubSelectProps = {
  categoryTree: Array<{
    id: string;
    name: string;
    subcategories: Array<{ id: string; name: string }>;
  }>;
  value: string; // subcategoryId
  onChange: (subId: string, categoryId: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

const CategorySubSelect = ({
  categoryTree,
  value,
  onChange,
  disabled,
  placeholder = "Избери (пр. Заштита на растенија → Хербициди)",
}: CategorySubSelectProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = (() => {
    for (const c of categoryTree) {
      for (const s of c.subcategories) {
        if (s.id === value) return `${c.name} → ${s.name}`;
      }
    }
    return "";
  })();

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const handlePick = (subId: string) => {
    let catId = "";
    for (const c of categoryTree) {
      if (c.subcategories.some((s) => s.id === subId)) {
        catId = c.id;
        break;
      }
    }
    onChange(subId, catId);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm
                   disabled:opacity-60 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
      >
        <span className={selectedLabel ? "text-slate-900" : "text-slate-500"}>
          {selectedLabel || placeholder}
        </span>
        <span className="float-right text-slate-500">▾</span>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-auto p-2">
            {categoryTree.map((c) => (
              <div key={c.id} className="mb-2">
                <div className="sticky top-0 z-10 bg-white px-2 py-2 text-sm font-semibold text-slate-900">
                  {c.name}
                </div>


                <div className="mt-1">
                  {c.subcategories.map((s) => {
                    const isActive = value === s.id;
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => handlePick(s.id)}
                        className={[
                          "w-full rounded-lg px-3 py-2 text-left text-sm",
                          isActive ? "bg-blamejaGreen/10 text-slate-900" : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ReceivePage = () => {
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");

  // (опционални полиња)
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [sellingPrice, setSellingPrice] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");

  // задолжителни селекции
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  // задолжително
  const [qty, setQty] = useState("1");

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // резултат од проверка
  const [checked, setChecked] = useState<StockLookupRow | null>(null);

  const {
    data: categoryTree = [],
    isLoading: categoryTreeLoading,
    isError: categoryTreeIsError,
    error: categoryTreeErrorRaw,
  } = useCategoryTree();
  const categoryTreeError = categoryTreeIsError ? (categoryTreeErrorRaw as Error) : null;

  const { lookupStock, isLoading: stockLoading } = useStockLookup();

  const receiveMutation = useReceiveMutation({
    sku,
    barcode,
    name,
    description,
    unit,
    sellingPrice,
    qty,
    unitCost,
    note,
    categoryId,
    subcategoryId,
  });

  const formDisabledBase = categoryTreeLoading || !!categoryTreeError;

  const isFormValid =
    (sku.trim().length > 0 || barcode.trim().length > 0) &&
    Number(qty.replace(",", ".")) > 0 &&
    categoryId.trim().length > 0 &&
    subcategoryId.trim().length > 0;

  const isSubmitDisabled =
    receiveMutation.isPending || stockLoading || formDisabledBase || !isFormValid;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    receiveMutation.mutate(undefined, {
      onSuccess: () => toast.success("Приемот е успешно зачуван ✅"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Грешка при прием."),
    });
  };

  const handleReset = () => {
    setSku("");
    setBarcode("");
    setName("");
    setUnit("pcs");
    setSellingPrice("");
    setUnitCost("");
    setDescription("");
    setNote("");
    setCategoryId("");
    setSubcategoryId("");
    setQty("1");
    setScanError(null);
    setIsScannerOpen(false);
    setChecked(null);
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

  const handleCheck = async () => {
    const key = barcode.trim() || sku.trim();
    if (!key) {
      toast.error("Внеси SKU или баркод (барем едно).");
      return;
    }

    try {
      const row = await lookupStock(key);
      setChecked(row);

      if (!row) {
        toast.error("Не е пронајден производ во база.");
        return;
      }

      toast.success(`На залиха: ${row.qty_on_hand ?? 0}`);
    } catch (e) {
      console.error(e);
      toast.error("Грешка при проверка на залиха.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Прием на стока</h1>
          <p className="mt-1 text-xs text-slate-500">
            Проверка: покажува состојба на залиха за внесена шифра/баркод.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => {
              setScanError(null);
              setIsScannerOpen(true);
            }}
            className="rounded-3xl bg-blamejaGreen px-8 py-4 text-md font-semibold text-white shadow-sm hover:bg-blamejaGreenDark"
          >
            Скенирај баркод
          </button>

          {scanError && (
            <span className="max-w-[220px] text-right text-[10px] text-blamejaRed">
              {scanError}
            </span>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200"
      >
        {/* SKU + Barcode + Check (иста линија) */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Внеси SKU или Баркод (барем едно).</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                placeholder="AG-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Баркод</label>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                placeholder="3830..."
              />
            </div>

            <div className="flex md:justify-end md:items-end">
              <button
                type="button"
                onClick={() => void handleCheck()}
                disabled={stockLoading}
                className="w-full md:w-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700
                           hover:bg-slate-50 disabled:opacity-60"
              >
                {stockLoading ? "Проверувам..." : "Проверка"}
              </button>
            </div>
          </div>

          {/* РЕЗУЛТАТ од проверка (цел ред) */}
            {checked && (
            <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                {/* Close button */}
                <button
                type="button"
                onClick={() => setChecked(null)}
                className="absolute right-2 top-2 rounded-full px-2 py-1 text-sm text-slate-600 hover:bg-white hover:text-slate-900"
                aria-label="Затвори"
                title="Затвори"
                >
                ✕
                </button>

                <div className="flex items-center justify-between gap-3 pr-8">
                <div className="font-semibold text-slate-800">
                    Во база имаш:{" "}
                    <span className="text-blamejaGreen">{checked.qty_on_hand ?? 0}</span>{" "}
                    {checked.unit ?? ""}
                </div>
                </div>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[13px]">
                <div>
                    <span className="text-slate-500">SKU:</span> {checked.sku ?? "—"}
                </div>
                <div>
                    <span className="text-slate-500">Баркод:</span> {checked.barcode ?? "—"}
                </div>
                <div className="md:col-span-2">
                    <span className="text-slate-500">Име:</span> {checked.name ?? "—"}
                </div>
                <div>
                    <span className="text-slate-500">Категорија:</span>{" "}
                    {checked.category_name ?? "—"}
                </div>
                <div>
                    <span className="text-slate-500">Подкатегорија:</span>{" "}
                    {checked.subcategory_name ?? "—"}
                </div>
                <div>
                    <span className="text-slate-500">Продажна:</span> {checked.selling_price ?? 0}
                </div>
                <div>
                    <span className="text-slate-500">Последно движење:</span>{" "}
                    {checked.last_movement_at ?? "—"}
                </div>
                </div>
            </div>
            )}

        </div>

        {/* Категорија пред Име/Единица */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Категорија / Подкатегорија
          </label>

          <CategorySubSelect
            categoryTree={categoryTree}
            value={subcategoryId}
            disabled={categoryTreeLoading || !!categoryTreeError}
            onChange={(subId, catId) => {
              setSubcategoryId(subId);
              setCategoryId(catId);
            }}
          />

          {categoryTreeError && (
            <p className="text-xs text-blamejaRed">{categoryTreeError.message}</p>
          )}
        </div>

        {/* Име + Единица */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Име на производ (опционално)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="име..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Единица (опционално)</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="pcs / l / kg"
            />
          </div>
        </div>

        {/* Количина задолжително, цени опционално */}
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
            <label className="block text-sm font-medium mb-1">Набавна (опционално)</label>
            <input
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
              placeholder="пр. 120"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Продажна (опционално)</label>
            <input
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
              placeholder="пр. 160"
            />
          </div>
        </div>

        {/* Опис и Забелешка најдолу */}
        <div>
        <label className="block text-sm font-medium mb-1">Опис (опционално)</label>
        <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[90px]"
            placeholder="Пр. активна материја, дозирање, намена..."
        />
        </div>

        <div>
        <label className="block text-sm font-medium mb-1">Забелешка (опционално)</label>
        <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[70px]"
            placeholder="Пр. добавувач, број на фактура, датум, дополнителни информации..."
        />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
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
        {receiveMutation.isSuccess && (
          <p className="text-green-600 text-sm">Приемот е успешно снимен.</p>
        )}
      </form>

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
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceivePage;
