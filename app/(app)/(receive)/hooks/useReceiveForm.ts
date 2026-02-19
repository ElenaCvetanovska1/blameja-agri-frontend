"use client";

import { useMemo, useState } from "react";
import type { TaxGroup } from "../types";
import { parseNumOrNull } from "../utils";

export const useReceiveForm = () => {
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");

  const [plu, setPlu] = useState("");
  const [barcode, setBarcode] = useState("");

  const [sellingPrice, setSellingPrice] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [details, setDetails] = useState("");

  const [qty, setQty] = useState("1");
  const [taxGroup, setTaxGroup] = useState<TaxGroup>("5");

  const reset = () => {
    setCategoryId("");
    setName("");
    setPlu("");
    setBarcode("");
    setSellingPrice("");
    setUnitCost("");
    setDetails("");
    setQty("1");
    setTaxGroup("18");
  };

  const isValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!categoryId.trim()) return false;
    if (!plu.trim()) return false;

    const q = parseNumOrNull(qty);
    if (q === undefined || q === null || q <= 0) return false;

    const sp = parseNumOrNull(sellingPrice);
    if (sp === undefined) return false;

    const uc = parseNumOrNull(unitCost);
    if (uc === undefined) return false;

    return true;
  }, [name, categoryId, plu, qty, sellingPrice, unitCost]);

  return {
    categoryId,
    setCategoryId,
    name,
    setName,
    plu,
    setPlu,
    barcode,
    setBarcode,
    sellingPrice,
    setSellingPrice,
    unitCost,
    setUnitCost,
    details,
    setDetails,
    qty,
    setQty,
    taxGroup,
    setTaxGroup,
    reset,
    isValid,
  };
};
