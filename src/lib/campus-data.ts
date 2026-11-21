import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EdgeRow, LiftRow, NodeRow, PublicBarrier, SettingsRow } from "./db-types";
import type { GraphEdge, GraphLift, GraphNode, RouteContext } from "./routing/types";

export interface CampusData {
  settings: SettingsRow;
  nodes: NodeRow[];
  edges: EdgeRow[];
  lifts: LiftRow[];
  barriers: PublicBarrier[];
  /** true when any visible data is synthetic demo data */
  hasDemo: boolean;
}

export const DEFAULT_SETTINGS: SettingsRow = {
  id: 1,
  demo_mode: true,
  verification_freshness_days: 180,
  lift_status_freshness_hours: 24,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

/** Loads all public campus data. Demo rows are hidden when demo mode is off. */
export async function fetchCampusData(): Promise<CampusData> {
  const [s, n, e, l, b] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("route_nodes").select("*").order("name"),
    supabase.from("route_edges").select("*"),
    supabase.from("lifts").select("*").order("label"),
    supabase.rpc("get_public_barriers"),
  ]);
  for (const r of [s, n, e, l, b]) if (r.error) throw new Error(r.error.message);
  const settings = s.data ?? DEFAULT_SETTINGS;
  const keep = <X extends { is_demo: boolean }>(rows: X[]) =>
    settings.demo_mode ? rows : rows.filter((r) => !r.is_demo);
  const nodes = keep(n.data ?? []);
  const nodeIds = new Set(nodes.map((x) => x.id));
  const edges = keep(e.data ?? []).filter((x) => nodeIds.has(x.from_node_id) && nodeIds.has(x.to_node_id));
  const lifts = keep(l.data ?? []);
  return {
    settings,
    nodes,
    edges,
    lifts,
    barriers: b.data ?? [],
    hasDemo: nodes.some((x) => x.is_demo),
  };
}

export const campusDataQuery = queryOptions({
  queryKey: ["campus-data"],
  queryFn: fetchCampusData,
  staleTime: 30_000,
});

export function toGraph(data: CampusData) {
  const nodes: GraphNode[] = data.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    lat: n.lat,
    lng: n.lng,
    is_demo: n.is_demo,
    verification_status: n.verification_status,
    last_verified_at: n.last_verified_at,
  }));
  const edges: GraphEdge[] = data.edges.map((e) => ({
    id: e.id,
    from_node_id: e.from_node_id,
    to_node_id: e.to_node_id,
    name: e.name,
    distance_m: Number(e.distance_m),
    surface: e.surface,
    clear_width_m: e.clear_width_m === null ? null : Number(e.clear_width_m),
    slope_percent: e.slope_percent === null ? null : Number(e.slope_percent),
    has_steps: e.has_steps,
    step_count: e.step_count,
    has_kerb: e.has_kerb,
    has_ramp: e.has_ramp,
    ramp_verified: e.ramp_verified,
    lift_id: e.lift_id,
    barrier_status: e.barrier_status,
    barrier_note: e.barrier_note,
    classification: e.classification,
    verification_status: e.verification_status,
    last_verified_at: e.last_verified_at,
    is_demo: e.is_demo,
  }));
  const lifts: GraphLift[] = data.lifts.map((l) => ({
    id: l.id,
    label: l.label,
    status: l.status,
    status_updated_at: l.status_updated_at,
  }));
  const ctx: RouteContext = {
    now: new Date(),
    freshnessDays: data.settings.verification_freshness_days,
    liftFreshnessHours: data.settings.lift_status_freshness_hours,
    reportedEdgeIds: new Set(data.barriers.map((b) => b.edge_id).filter((x): x is string => !!x)),
    reportedNodeIds: new Set(data.barriers.map((b) => b.node_id).filter((x): x is string => !!x)),
  };
  return { nodes, edges, lifts, ctx };
}

/** Selectable places for start/destination pickers. */
export function selectableNodes(nodes: NodeRow[]) {
  return nodes
    .filter((n) => n.is_destination || ["building", "entrance", "destination", "lift"].includes(n.kind))
    .sort((a, b) => a.name.localeCompare(b.name));
}


/** Live updates: refetch campus data when lifts or pathways change. */
export function useCampusRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`campus-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lifts" }, () => {
        void qc.invalidateQueries({ queryKey: ["campus-data"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "route_edges" }, () => {
        void qc.invalidateQueries({ queryKey: ["campus-data"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);
}
