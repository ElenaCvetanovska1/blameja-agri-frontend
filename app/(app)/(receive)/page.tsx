"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { toast } from "sonner";

import { useCategories } from "./hooks/useCategories";
import { useSubcategories } from "./hooks/useSubcategories";
import { useProductLookup } from "./hooks/useProductLookup";
import { useReceiveMutation } from "./hooks/useReceiveMutation";

const ReceivePage = () => {
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("pcs");

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [note, setNote] = useState("");

  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubcategoryCode, setNewSubcategoryCode] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const {
    categories,
    categoriesLoading,
    categoriesError,
    addCategory,
    addCategoryLoading,
    addCategoryError,
  } = useCategories();

  const {
    subcategories,
    subcategoriesLoading,
    subcategoriesError,
    addSubcategory,
    addSubcategoryLoading,
    addSubcategoryError,
  } = useSubcategories(categoryId);

  const { lookup, isLoading: lookupLoading } = useProductLookup();

  useEffect(() => {
    setSubcategoryId("");
  }, [categoryId]);

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

  const formDisabledBase =
    categoriesLoading ||
    subcategoriesLoading ||
    !!categoriesError ||
    !!subcategoriesError;

  const isFormValid =
    name.trim().length > 0 &&
    categoryId.trim().length > 0 &&
    subcategoryId.trim().length > 0 &&
    (sku.trim().length > 0 || barcode.trim().length > 0) &&
    Number(qty.replace(",", ".")) > 0;

  const isSubmitDisabled =
    receiveMutation.isPending || lookupLoading || formDisabledBase || !isFormValid;

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
    setDescription("");
    setUnit("pcs");
    setCategoryId("");
    setSubcategoryId("");
    setQty("1");
    setUnitCost("");
    setSellingPrice("");
    setNote("");

    setNewCategoryCode("");
    setNewCategoryName("");
    setNewSubcategoryCode("");
    setNewSubcategoryName("");

    setScanError(null);
    setIsScannerOpen(false);
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

  const handleLookup = async () => {
    const key = barcode.trim() || sku.trim();
    if (!key) {
      toast.error("Внеси баркод или SKU за проверка.");
      return;
    }

    try {
      const product = await lookup(key);
      if (!product) {
        toast.error("Не е пронајден производ.");
        return;
      }

      setSku(product.sku ?? "");
      setBarcode(product.barcode ?? "");
      setName(product.name ?? "");
      setDescription(product.description ?? "");
      setUnit(product.unit ?? "pcs");
      setSellingPrice(String(product.selling_price ?? 0));
      setCategoryId(product.category_id ?? "");
      setSubcategoryId(product.subcategory_id ?? "");

      toast.success("Производот е пополнет од база ✅");
    } catch (e) {
      console.error(e);
      toast.error("Грешка при проверка на производ.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Прием на стока</h1>
          <p className="mt-1 text-xs text-slate-500">
            Само набавна + продажна. Скенирај баркод и „Провери / Пополни“ ако
            артиклот веќе постои.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => {
              setScanError(null);
              setIsScannerOpen(true);
            }}
            className="rounded-full bg-blamejaGreen px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blamejaGreenDark"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">SKU (шифра)</label>
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
              onClick={() => void handleLookup()}
              disabled={lookupLoading}
              className="w-full md:w-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700
                         hover:bg-slate-50 disabled:opacity-60"
            >
              {lookupLoading ? "Проверувам..." : "Провери / Пополни"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Име на производ</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
              placeholder="Пр. Хербицид ..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Единица</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="pcs / l / kg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Опис (опционално)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[90px]"
            placeholder="Активна материја, дозирање..."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Категорија</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={categoriesLoading || !!categoriesError}
          >
            <option value="">
              {categoriesLoading ? "Се вчитуваат..." : "Избери категорија"}
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2 items-center">
            <input
              value={newCategoryCode}
              onChange={(e) => setNewCategoryCode(e.target.value)}
              placeholder="Код"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Име"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => addCategory(newCategoryCode, newCategoryName)}
              disabled={addCategoryLoading}
              className="px-3 py-2 rounded-full bg-blamejaOrange text-white text-xs font-semibold disabled:opacity-60"
            >
              {addCategoryLoading ? "..." : "+ Додај"}
            </button>
          </div>

          {addCategoryError && (
            <p className="text-xs text-blamejaRed">{addCategoryError.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Подкатегорија</label>
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={!categoryId || subcategoriesLoading || !!subcategoriesError}
          >
            <option value="">
              {!categoryId
                ? "Избери категорија прво"
                : subcategoriesLoading
                  ? "Се вчитуваат..."
                  : "Избери подкатегорија"}
            </option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2 items-center">
            <input
              value={newSubcategoryCode}
              onChange={(e) => setNewSubcategoryCode(e.target.value)}
              placeholder="Код"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              disabled={!categoryId}
            />
            <input
              value={newSubcategoryName}
              onChange={(e) => setNewSubcategoryName(e.target.value)}
              placeholder="Име"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              disabled={!categoryId}
            />
            <button
              type="button"
              onClick={() => addSubcategory(newSubcategoryCode, newSubcategoryName)}
              disabled={!categoryId || addSubcategoryLoading}
              className="px-3 py-2 rounded-full bg-blamejaOrange text-white text-xs font-semibold disabled:opacity-60"
            >
              {addSubcategoryLoading ? "..." : "+ Додај"}
            </button>
          </div>

          {addSubcategoryError && (
            <p className="text-xs text-blamejaRed">{addSubcategoryError.message}</p>
          )}
        </div>

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
            <label className="block text-sm font-medium mb-1">Набавна</label>
            <input
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
              placeholder="пр. 120"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Продажна</label>
            <input
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
              placeholder="пр. 160"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Забелешка</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[70px]"
            placeholder="Фактура, добавувач..."
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
    