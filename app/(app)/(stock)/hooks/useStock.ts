import { useQuery } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

export type StockRow = {
  product_id: string;
  plu: string | null;          // ✅ TEXT (како во view)
  barcode: string | null;
  name: string | null;
  selling_price: number | null;
  category_name: string | null;
  qty_on_hand: number | null;
};

const normalizeNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// digits-only -> treat as PLU candidate (TEXT)
const parsePluText = (raw: string) => {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  return t; // keep text
};

// (опц.) ако корисник внесе % или _ да не ти прави хаос во ilike
const escapeLike = (s: string) => s.replace(/[%_]/g, "\\$&");

export const useStock = (search: string) => {
  return useQuery({
    queryKey: ["stock", search],
    queryFn: async () => {
      let q = supabase
        .from("product_stock")
        .select("product_id, plu, barcode, name, selling_price, qty_on_hand, category_name")
        .order("name", { ascending: true });

      const termRaw = search.trim();
      if (termRaw.length > 0) {
        const term = escapeLike(termRaw);
        const pluText = parsePluText(termRaw);

        const orParts: string[] = [];
        orParts.push(`barcode.ilike.%${term}%`);
        orParts.push(`name.ilike.%${term}%`);

        // ✅ КЛУЧНО: PLU e TEXT -> пребарувај со ilike (partial match)
        orParts.push(`plu.ilike.%${term}%`);

        // ✅ ако е digits, додади и exact match (брзо)
        if (pluText) {
          orParts.push(`plu.eq.${pluText}`);
        }

        q = q.or(orParts.join(","));
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as StockRow[];
      return rows.map((r) => ({
        ...r,
        selling_price: normalizeNumber((r as any).selling_price),
        qty_on_hand: normalizeNumber((r as any).qty_on_hand),
      }));
    },
  });
};
