"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";
import type { ProductChoiceRow } from "../types";
import { useDebouncedValue } from "./useDebouncedValue";

type Args = {
  name: string;
  categoryId: string;
  limit?: number;
};

export const useProductChoices = ({ name, categoryId, limit = 10 }: Args) => {
  const term = useDebouncedValue(name.trim(), 220);

  const enabled = term.length >= 1;

  return useQuery({
    queryKey: ["receive", "product-choices", term, categoryId, limit],
    enabled,
    queryFn: async () => {
      const _q = term.length ? term : null;
      const _category_id = categoryId.trim() ? categoryId.trim() : null;

      const { data, error } = await supabase.rpc("product_choices_search", {
        _category_id,
        _q,
        _limit: limit,
      });

      if (error) throw error;
      return (data ?? []) as ProductChoiceRow[];
    },
    staleTime: 10_000,
  });
};
