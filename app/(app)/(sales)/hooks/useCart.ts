"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { CartItem, ProductStockRow, Totals } from "../types";
import { num, percentNum, priceNum, round2, safeText } from "../utils";

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const totals: Totals = useMemo(() => {
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

  const resetCart = () => setCart([]);

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
      const idx = prev.findIndex((p) => p.product.id === productId);

      // NEW item -> put on top
      if (idx === -1) {
        const base = round2(num(product.selling_price));
        const newItem: CartItem = {
          product,
          qty: 1,
          priceStr: base > 0 ? String(base) : "",
          discountPercentStr: "",
        };
        return [newItem, ...prev];
      }

      // EXISTING item -> increase qty and move to top
      const updated: CartItem = { ...prev[idx], qty: prev[idx].qty + 1 };
      return [updated, ...prev.filter((_, i) => i !== idx)];
    });

    toast.success(`Додадено: ${product.name}`);
  };

  return {
    cart,
    setCart,
    totals,
    resetCart,
    updateItem,
    removeItem,
    changeQty,
    addToCartFromRow,
  };
}
