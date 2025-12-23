import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "app/lib/supabase-client";

export type Category = {
  id: string;
  code: string;
  name: string;
};

export const useCategories = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, code, name")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const addCategoryMutation = useMutation({
    mutationFn: async (payload: { code: string; name: string }) => {
      const code = payload.code.trim().toUpperCase();
      const name = payload.name.trim();

      if (!code) throw new Error("Внеси код за категорија.");
      if (!name) throw new Error("Внеси име за категорија.");

      const { data, error } = await supabase
        .from("categories")
        .insert({ code, name })
        .select("id, code, name")
        .single();

      if (error) throw error;
      return data as Category;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const addCategory = (code: string, name: string) => {
    addCategoryMutation.mutate({ code, name });
  };

  return {
    categories: data ?? [],
    categoriesLoading: isLoading,
    categoriesError: isError ? (error as Error) : null,

    addCategory,
    addCategoryLoading: addCategoryMutation.isPending,
    addCategoryError: addCategoryMutation.isError
      ? (addCategoryMutation.error as Error)
      : null,
  };
};
