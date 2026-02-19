import { useQuery } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

export type TopProductRow = {
  product_id: string;
  plu: string | null; // ✅ TEXT
  name: string;
  qty: number;
  revenue: number;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pluText = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // ако сакаш строго digits-only:
  // if (!/^\d+$/.test(s)) return null;
  return s;
};

export const useTopProducts = (fromISO: string, toISO: string, limit = 8) => {
  return useQuery({
    queryKey: ["finance-top-products", fromISO, toISO, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_top_products", {
        _from: fromISO,
        _to: toISO,
        _limit: limit,
      });

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        product_id: string;
        plu: unknown;
        name: string;
        qty: unknown;
        revenue: unknown;
      }>;

      return rows.map(
        (r): TopProductRow => ({
          product_id: r.product_id,
          plu: pluText(r.plu),
          name: r.name,
          qty: num(r.qty),
          revenue: num(r.revenue),
        })
      );
    },
  });
};
