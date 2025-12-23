import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

type Payload = {
  productId: string;
  direction: "PLUS" | "MINUS";
  qty: string;
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
      const qtyNum = parseQty(payload.qty);

      if (!payload.productId) throw new Error("Нема избран производ.");
      if (!payload.reason.trim()) throw new Error("Внеси причина (кратко).");
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        throw new Error("Количината мора да биде број поголем од 0.");
      }

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id ?? null;

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

      const { error: iErr } = await supabase.from("stock_movement_items").insert({
        movement_id: movement.id,
        product_id: payload.productId,
        qty: qtyNum,
        adjust_direction: payload.direction,
        unit_cost: payload.unitCost ?? 0,
        unit_price: payload.unitPrice ?? 0,
      });

      if (iErr) throw iErr;

      await queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
  });
};
