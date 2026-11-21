import type {
  AccessClass,
  AppRole,
  BarrierState,
  LiftStatusValue,
  NodeKind,
  ReportCategory,
  ReportPriority,
  ReportStatus,
  SurfaceValue,
} from "./db-types";

export const DEMO_LABEL =
  "Synthetic demonstration data – not verified LPU accessibility information";

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  broken_ramp: "Broken or missing ramp",
  ramp_ends_at_step: "Ramp ending at a step",
  blocked_pathway: "Blocked pathway",
  damaged_pavement: "Damaged pavement",
  locked_entrance: "Locked accessible entrance",
  lift_not_working: "Lift not working",
  missing_signage: "Missing signage",
  narrow_pathway: "Narrow pathway",
  other: "Other accessibility issue",
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  new: "New",
  under_review: "Under review",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

export const STATUS_FLOW: ReportStatus[] = ["new", "under_review", "assigned", "in_progress", "resolved"];

export const PRIORITY_LABELS: Record<ReportPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const LIFT_STATUS_LABELS: Record<LiftStatusValue, string> = {
  operational: "Operational",
  out_of_service: "Out of service",
  under_maintenance: "Under maintenance",
  unknown: "Status unknown",
};

export const KIND_LABELS: Record<NodeKind, string> = {
  building: "Building",
  entrance: "Entrance",
  junction: "Junction",
  lift: "Lift",
  ramp: "Ramp",
  checkpoint: "Checkpoint",
  destination: "Destination",
  other: "Other",
};

export const SURFACE_LABELS: Record<SurfaceValue, string> = {
  smooth_paved: "Smooth paved",
  paved: "Paved",
  paving_blocks: "Paving blocks",
  gravel: "Gravel",
  rough: "Rough",
  grass: "Grass",
  indoor: "Indoor floor",
  unknown: "Not recorded",
};

export const BARRIER_LABELS: Record<BarrierState, string> = {
  clear: "Clear",
  caution: "Caution",
  blocked: "Blocked",
};

export const ACCESS_LABELS: Record<AccessClass, string> = {
  accessible: "Accessible",
  limited: "Limited access",
  inaccessible: "Not accessible",
  unknown: "Unknown",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  student: "Student",
  estate_staff: "Estate Staff",
  lift_operator: "Lift Operator",
  admin: "Administrator",
};

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "Never";
  const d = new Date(value);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function timeAgo(value: string | null | undefined) {
  if (!value) return "never";
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
