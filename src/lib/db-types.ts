import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
type E = Database["public"]["Enums"];

export type NodeRow = T["route_nodes"]["Row"];
export type EdgeRow = T["route_edges"]["Row"];
export type LiftRow = T["lifts"]["Row"];
export type SettingsRow = T["app_settings"]["Row"];
export type ReportRow = T["barrier_reports"]["Row"];
export type NotificationRow = T["notifications"]["Row"];
export type AppRole = E["app_role"];
export type NodeKind = E["node_kind"];
export type ReportCategory = E["report_category"];
export type ReportStatus = E["report_status"];
export type ReportPriority = E["report_priority"];
export type LiftStatusValue = E["lift_status"];
export type SurfaceValue = E["surface_type"];
export type BarrierState = E["barrier_state"];
export type AccessClass = E["access_class"];

export type PublicBarrier =
  Database["public"]["Functions"]["get_public_barriers"]["Returns"][number];
