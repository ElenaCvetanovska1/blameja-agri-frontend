"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useReceiveMutation } from "./hooks/useReceiveMutation";
import { useCategoryOptions } from "./hooks/useCategoryOptions";
import { useProductChoices } from "./hooks/useProductChoices";
import { useReceiveForm } from "./hooks/useReceiveForm";

import { ProductNameWithSuggestions } from "./components/ProductNameWithSuggestions";
import { ScannerModal } from "./components/ScannerModal";

import { KPK_CODE, KPK_FISCAL_PLU, normalizeTaxGroup, num } from "./utils";
import type { ProductChoiceRow, TaxGroup } from "./types";

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const ReceivePage = () => {
  const form = useReceiveForm();

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // ✅ NEW: invoice inputs (local only for now)
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());

  const categoriesQuery = useCategoryOptions();

  const selectedCategory = useMemo(() => {
    return (categoriesQuery.data ?? []).find((c) => c.id === form.categoryId) ?? null;
  }, [categoriesQuery.data, form.categoryId]);

  const isKpk = useMemo(() => {
    return (selectedCategory?.code ?? "").toLowerCase() === KPK_CODE;
  }, [selectedCategory]);

  const choicesQuery = useProductChoices({
    name: form.name,
    categoryId: form.categoryId,
    limit: 10,
  });

  const receiveMutation = useReceiveMutation({
    plu: form.plu,
    barcode: form.barcode,
    name: form.name,
    sellingPrice: form.sellingPrice,
    qty: form.qty,
    unitCost: form.unitCost,
    description: form.details,
    note: form.details,
    categoryId: form.categoryId,
    taxGroup: form.taxGroup,
  });

  const isSubmitDisabled =
    receiveMutation.isPending ||
    categoriesQuery.isLoading ||
    !!categoriesQuery.error ||
    !form.isValid;

  const onPick = (row: ProductChoiceRow) => {
    setSelectedProductId(row.product_id);

    const pickedName = (row.name ?? "").trim();
    form.setName(pickedName);

    if (row.category_id) form.setCategoryId(row.category_id);

    form.setPlu((row.plu ?? "").trim());
    form.setBarcode(row.barcode ?? "");
    form.setSellingPrice(row.selling_price === null ? "" : String(num(row.selling_price)));

    const tg = normalizeTaxGroup(row.tax_group) as TaxGroup;
    form.setTaxGroup(tg);

    toast.success("Избран производ ✅");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();

    receiveMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Приемот е успешно зачуван ✅");
        setSelectedProductId(null);
        form.reset();

        // optional: keep invoice fields (usually user continues with same invoice)
        // setInvoiceNumber("");
        // setSupplier("");
        // setInvoiceDate(todayISO());
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Грешка при прием."),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Прием на стока</h1>
          <p className="mt-1 text-xs text-slate-500">
            Внеси фактура, избери категорија и артикл. PLU е задолжителен, баркод е опционален.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setScanError(null);
              setScannerOpen(true);
            }}
            className="rounded-full bg-blamejaGreen px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blamejaGreenDark"
          >
            Скенирај баркод
          </button>
        </div>

        {scanError && (
          <span className="block w-full text-[11px] text-blamejaRed">
            {scanError}
          </span>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
      >
        {/* ✅ Invoice block (compact) */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 md:p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700">
                Број на фактура
              </label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                placeholder="пр. 2026-00125"
              />
            </div>

            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-700">
                Добавувач
              </label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
                placeholder="пр. Agro Partner"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700">
                Датум
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
              />
            </div>
          </div>
        </div>

        {/* ✅ Category + (optional) fiscal info */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Category (not full width) */}
          <div className="md:col-span-6">
            <label className="block text-sm font-medium">Категорија</label>

            <select
              value={form.categoryId}
              onChange={(e) => {
                form.setCategoryId(e.target.value);
                setSelectedProductId(null);
              }}
              disabled={categoriesQuery.isLoading || !!categoriesQuery.error}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">
                {categoriesQuery.isLoading ? "Се вчитува..." : "Избери категорија"}
              </option>

              {(categoriesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {categoriesQuery.error && (
              <p className="mt-2 text-xs text-blamejaRed">Грешка при вчитување категории.</p>
            )}
          </div>

          {/* Fiscal PLU (only for KPK) */}
          {isKpk && (
            <div className="md:col-span-6">
              <label className="block text-sm font-medium">Фискална шифра (фиксно)</label>
              <input
                value={String(KPK_FISCAL_PLU)}
                readOnly
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
              <p className="mt-2 text-[11px] text-slate-500">
                За „Систем капка по капка“ сите артикли се сумираат на фискална под шифра{" "}
                {KPK_FISCAL_PLU}.
              </p>
            </div>
          )}
        </div>

        {/* Name + suggestions */}
        <ProductNameWithSuggestions
          value={form.name}
          onChange={(v) => {
            form.setName(v);
            setSelectedProductId(null);
          }}
          placeholder={
            form.categoryId
              ? "Почни да куцаш (ќе пребарува во избраната категорија)…"
              : "Почни да куцаш (ќе се пополни категорија кога ќе избереш)…"
          }
          loading={choicesQuery.isFetching}
          suggestions={choicesQuery.data ?? []}
          onPick={onPick}
        />

        {/* ✅ One smart row: PLU + Barcode + Tax + Qty */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {/* PLU */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium">
              PLU <span className="text-blamejaRed">*</span>
            </label>
            <input
              value={form.plu}
              onChange={(e) => {
                form.setPlu(e.target.value.replace(/[^\d]/g, ""));
                setSelectedProductId(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
              placeholder="пр. 125"
              inputMode="numeric"
            />
            <p className="mt-1 text-[11px] text-slate-500">PLU е задолжителен.</p>
          </div>

          {/* Barcode */}
          <div className="md:col-span-4">
            <label className="block text-sm font-medium">Баркод (опц.)</label>
            <input
              value={form.barcode}
              onChange={(e) => {
                form.setBarcode(e.target.value);
                setSelectedProductId(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
              placeholder="3830..."
            />
            <p className="mt-1 text-[11px] text-slate-500">Опционално.</p>
          </div>

          {/* Tax compact */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium">ДДВ</label>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["5", "10", "18"] as const).map((v) => {
                const active = form.taxGroup === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      form.setTaxGroup(v);
                      setSelectedProductId(null);
                    }}
                    className={[
                      "h-10 rounded-xl border text-sm font-semibold",
                      active
                        ? "border-blamejaGreen bg-blamejaGreen/10 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                    title={`ДДВ ${v}%`}
                  >
                    {v}%
                  </button>
                );
              })}
            </div>

            <p className="mt-1 text-[11px] text-slate-500">Избери 5/10/18.</p>
          </div>

          {/* Qty */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">Количина</label>
            <input
              value={form.qty}
              onChange={(e) => form.setQty(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
              inputMode="decimal"
            />
            <p className="mt-1 text-[11px] text-slate-500">пр. 1 / 2.5</p>
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="block text-sm font-medium">Набавна (опц.)</label>
            <input
              value={form.unitCost}
              onChange={(e) => {
                form.setUnitCost(e.target.value);
                setSelectedProductId(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
              placeholder="пр. 120"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium">Продажна (опц.)</label>
            <input
              value={form.sellingPrice}
              onChange={(e) => {
                form.setSellingPrice(e.target.value);
                setSelectedProductId(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              inputMode="decimal"
              placeholder="пр. 160"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium">Брза забелешка (опц.)</label>
            <input
              value={form.details}
              onChange={(e) => form.setDetails(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="пр. број на серија, добавувач..."
            />
          </div>
        </div>

        {/* Details (bigger textarea kept) */}
        <div>
          <label className="block text-sm font-medium mb-2">Опис / Забелешка (опц.)</label>
          <textarea
            value={form.details}
            onChange={(e) => form.setDetails(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[110px]"
            placeholder="Пр. активна материја, дозирање, добавувач, број на фактура..."
          />
        </div>

        {/* Actions */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedProductId(null);
              form.reset();
            }}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ресетирај форма
          </button>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="rounded-full bg-blamejaGreen px-5 py-2 text-sm font-semibold text-white
                       disabled:opacity-60"
          >
            {receiveMutation.isPending ? "Се зачувува..." : "Зачувај прием"}
          </button>
        </div>

        {receiveMutation.isError && (
          <p className="text-blamejaRed text-sm">{(receiveMutation.error as Error).message}</p>
        )}
      </form>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(raw) => {
          form.setBarcode(raw);
          toast.message("Скенирано", { description: raw });
        }}
        errorText={scanError}
        setErrorText={setScanError}
      />
    </div>
  );
};

export default ReceivePage;
