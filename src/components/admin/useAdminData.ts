import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS } from "@/lib/campus-data";

/** All map rows including demo data, for administration. */
export function useAdminData() {
  return useQuery({
    queryKey: ["admin", "graph"],
    queryFn: async () => {
      const [s, n, e, l] = await Promise.all([
        supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("route_nodes").select("*").order("name"),
        supabase.from("route_edges").select("*").order("created_at"),
        supabase.from("lifts").select("*").order("label"),
      ]);
      for (const r of [s, n, e, l]) if (r.error) throw new Error(r.error.message);
      return { settings: s.data ?? DEFAULT_SETTINGS, nodes: n.data ?? [], edges: e.data ?? [], lifts: l.data ?? [] };
    },
  });
}

export function useInvalidateMap() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin"] });
    void qc.invalidateQueries({ queryKey: ["campus-data"] });
  };
}

export const selectCls = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base";
