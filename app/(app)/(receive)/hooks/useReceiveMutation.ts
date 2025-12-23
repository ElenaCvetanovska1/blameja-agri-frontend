import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

type ReceivePayload = {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  unit: string;
  sellingPrice: string; // products.selling_price
  qty: string;          // stock_movement_items.qty
  unitCost: string;     // stock_movement_items.unit_cost
  note: string;
  categoryId: string;
  subcategoryId: string;
};

const parseNum = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number.parseFloat(trimmed.replace(",", "."));
  if (Number.isNaN(num)) return undefined;
  return num;
};

export const useReceiveMutation = (payload: ReceivePayload) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const sku = payload.sku.trim();
      const barcode = payload.barcode.trim();
      const name = payload.name.trim();
      const description = payload.description.trim();
      const unit = payload.unit.trim() || "pcs";
      const note = payload.note.trim();

      const categoryId = payload.categoryId.trim();
      const subcategoryId = payload.subcategoryId.trim();

      if (!sku && !barcode) throw new Error("Внеси SKU или баркод (барем едно).");
      if (!name) throw new Error("Внеси име на производ.");
      if (!categoryId) throw new Error("Избери категорија.");
      if (!subcategoryId) throw new Error("Избери подкатегорија.");

      const qtyNum = parseNum(payload.qty);
      if (qtyNum === undefined) throw new Error("Количина: невалиден број.");
      if (qtyNum === null || qtyNum <= 0) throw new Error("Количина мора да е > 0.");

      const unitCostNum = parseNum(payload.unitCost);
      if (unitCostNum === undefined) throw new Error("Набавна: невалиден број.");
      const safeUnitCost = unitCostNum ?? 0;

      const sellingPriceNum = parseNum(payload.sellingPrice);
      if (sellingPriceNum === undefined) throw new Error("Продажна: невалиден број.");
      const safeSellingPrice = sellingPriceNum ?? 0;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const lookupKey = sku || barcode;

      const { data: existing, error: lookupError } = await supabase
        .from("products")
        .select("id")
        .or(`sku.eq.${lookupKey},barcode.eq.${lookupKey}`)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let productId: string;

      if (!existing) {
        const { data: inserted, error: insertError } = await supabase
          .from("products")
          .insert({
            sku: sku || lookupKey,
            barcode: barcode || null,
            name,
            description: description || null,
            unit,
            selling_price: safeSellingPrice,
            is_active: true,
            category_id: categoryId,
            subcategory_id: subcategoryId,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        productId = inserted.id as string;
      } else {
        productId = existing.id as string;

        const { error: updateError } = await supabase
          .from("products")
          .update({
            sku: sku || lookupKey,
            barcode: barcode || null,
            name,
            description: description || null,
            unit,
            selling_price: safeSellingPrice,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            is_active: true,
          })
          .eq("id", productId);

        if (updateError) throw updateError;
      }

      const { data: movement, error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          type: "IN",
          note: note || "Прием на стока",
          created_by: userId,
        })
        .select("id")
        .single();

      if (movementError) throw movementError;

      const movementId = movement.id as string;

      const { error: itemError } = await supabase
        .from("stock_movement_items")
        .insert({
          movement_id: movementId,
          product_id: productId,
          qty: qtyNum,
          unit_cost: safeUnitCost,
          unit_price: safeSellingPrice, // за историја: која продажна била во моментот на прием
        });

      if (itemError) throw itemError;

      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["stock"] });

      return { productId, movementId };
    },
  });
};
