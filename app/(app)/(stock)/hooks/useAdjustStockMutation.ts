import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

type Payload = {
  productId: string;
  targetQty: string;     // ✅ корисник внесува “нова залиха”
  currentQty: number;    // ✅ моментална залиха од табелата
  reason: string;
  unitCost?: number;
  unitPrice?: number;
};

const parseQty = (raw: string) => {
  const v = raw.trim().replace(",", ".");
  const num = Number.parseFloat(v);
  return Number.isFinite(num) ? num : NaN;
};

export const useAdjustStockMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Payload) => {
      if (!payload.productId) throw new Error("Нема избран производ.");
      if (!payload.reason.trim()) throw new Error("Внеси причина (кратко).");

      const target = parseQty(payload.targetQty);
      if (!Number.isFinite(target) || target < 0) {
        throw new Error("Нова залиха мора да биде број >= 0.");
      }

      const current = Number(payload.currentQty ?? 0);
      const delta = target - current;

      if (Math.abs(delta) < 0.0000001) {
        throw new Error("Нема промена (новата залиха е иста).");
      }

      const direction: "PLUS" | "MINUS" = delta > 0 ? "PLUS" : "MINUS";
      const qtyToApply = Math.abs(delta);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id ?? null;

      // 1) movement ADJUST
      const { data: movement, error: mErr } = await supabase
        .from("stock_movements")
        .insert({
          type: "ADJUST",
          note: payload.reason.trim(),
          created_by: userId,
        })
        .select("id")
        .single();

      if (mErr) throw mErr;

      // 2) item со computed direction
      const { error: iErr } = await supabase.from("stock_movement_items").insert({
        movement_id: movement.id,
        product_id: payload.productId,
        qty: qtyToApply,
        adjust_direction: direction,
        unit_cost: payload.unitCost ?? 0,
        unit_price: payload.unitPrice ?? 0,
      });

      if (iErr) throw iErr;

      await queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
  });
};
