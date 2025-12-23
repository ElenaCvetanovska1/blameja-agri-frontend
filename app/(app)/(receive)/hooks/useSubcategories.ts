import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

export type Subcategory = {
  id: string;
  category_id: string;
  code: string;
  name: string;
};

export const useSubcategories = (categoryId: string) => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["subcategories", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("id, category_id, code, name")
        .eq("category_id", categoryId)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Subcategory[];
    },
  });

  const addSubcategoryMutation = useMutation({
    mutationFn: async (payload: { categoryId: string; code: string; name: string }) => {
      const category_id = payload.categoryId;
      const code = payload.code.trim().toUpperCase();
      const name = payload.name.trim();

      if (!category_id) throw new Error("Избери категорија прво.");
      if (!code) throw new Error("Внеси код за подкатегорија.");
      if (!name) throw new Error("Внеси име за подкатегорија.");

      const { data, error } = await supabase
        .from("subcategories")
        .insert({ category_id, code, name })
        .select("id, category_id, code, name")
        .single();

      if (error) throw error;
      return data as Subcategory;
    },
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ["subcategories", vars.categoryId],
      });
    },
  });

  const addSubcategory = (code: string, name: string) => {
    addSubcategoryMutation.mutate({ categoryId, code, name });
  };

  return {
    subcategories: data ?? [],
    subcategoriesLoading: isLoading,
    subcategoriesError: isError ? (error as Error) : null,

    addSubcategory,
    addSubcategoryLoading: addSubcategoryMutation.isPending,
    addSubcategoryError: addSubcategoryMutation.isError
      ? (addSubcategoryMutation.error as Error)
      : null,
  };
};
