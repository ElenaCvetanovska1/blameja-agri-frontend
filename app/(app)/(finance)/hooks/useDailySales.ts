import { useQuery } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

export type DailySalesRow = {
  day: string; // YYYY-MM-DD
  receipts_count: number;
  total: number;
};

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const useDailySales = (fromISO: string, toISO: string) => {
  return useQuery({
    queryKey: ["finance-daily-sales", fromISO, toISO],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_daily_sales", {
        _from: fromISO,
        _to: toISO,
      });

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        day: string;
        receipts_count: unknown;
        total: unknown;
      }>;

      return rows.map(
        (r): DailySalesRow => ({
          day: r.day,
          receipts_count: Math.trunc(num(r.receipts_count)),
          total: num(r.total),
        }),
      );
    },
  });
};
