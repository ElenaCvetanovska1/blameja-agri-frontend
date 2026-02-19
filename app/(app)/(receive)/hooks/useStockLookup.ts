import { useMutation } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

export type StockLookupRow = {
  product_id: string;
  plu: string | null;
  barcode: string | null;
  name: string | null;
  selling_price: number | null;
  category_name: string | null;
  qty_on_hand: number | null;
};

const parseDigitsText = (raw: string) => {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  return t;
};

export const useStockLookup = () => {
  const mutation = useMutation({
    mutationFn: async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error("Внеси PLU или баркод.");

      const pluText = parseDigitsText(trimmed);

      const orParts: string[] = [];
      orParts.push(`barcode.eq.${trimmed}`);
      if (pluText) orParts.push(`plu.eq.${pluText}`);

      const { data, error } = await supabase
        .from("product_stock")
        .select("product_id, plu, barcode, name, selling_price, qty_on_hand, category_name")
        .or(orParts.join(","))
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as StockLookupRow | null;
    },
  });

  return {
    lookupStock: (code: string) => mutation.mutateAsync(code),
    isLoading: mutation.isPending,
    error: mutation.isError ? (mutation.error as Error) : null,
  };
};
