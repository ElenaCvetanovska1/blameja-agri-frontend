import { useQuery } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

export type StockRow = {
  product_id: string;
  plu: string | null; // ✅ TEXT
  barcode: string | null;
  name: string;
  selling_price: number;
  is_active: boolean;
  category_id: string | null;
  category_code: string | null;
  category_name: string | null;
  subcategory_id: string | null;
  subcategory_code: string | null;
  qty_on_hand: number;
  last_movement_at: string | null;
};

const normalizeNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parsePluText = (raw: string) => {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  return t; // ✅ keep as text
};

export const useStock = (search: string) => {
  return useQuery({
    queryKey: ["stock", search],
    queryFn: async () => {
      let q = supabase.from("product_stock").select("*").order("name", { ascending: true });

      const term = search.trim();

      if (term.length > 0) {
        const pluText = parsePluText(term);

        const orParts: string[] = [];
        orParts.push(`barcode.ilike.%${term}%`);
        orParts.push(`name.ilike.%${term}%`);

        // ✅ ако е digits, дозволи и exact match по plu (TEXT)
        if (pluText !== null) {
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
