import { useMutation } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

export type StockLookupRow = {
  product_id: string;
  plu: string | null; // ✅ TEXT
  barcode: string | null;
  name: string;
  selling_price: number;
  tax_group: number | null;
  category_name: string | null;
  qty_on_hand: number;
  last_movement_at: string | null;
};

const parsePluText = (raw: string) => {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  return t; // ✅ keep as text
};

export const useStockLookup = () => {
  const mutation = useMutation({
    mutationFn: async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) throw new Error("Внеси PLU или баркод.");

      const pluText = parsePluText(trimmed);

      const orParts: string[] = [];
      orParts.push(`barcode.eq.${trimmed}`);
      if (pluText !== null) orParts.push(`plu.eq.${pluText}`); // ✅ string compare

      const { data, error } = await supabase
        .from("product_stock")
        .select(
          "product_id, plu, barcode, name, selling_price, tax_group, category_name, qty_on_hand, last_movement_at"
        )
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
