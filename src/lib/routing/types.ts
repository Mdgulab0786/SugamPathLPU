export type MobilityMode =
  | "wheelchair"
  | "avoid_stairs"
  | "walking_aid"
  | "temporary_injury"
  | "general";

export type SurfaceType =
  | "smooth_paved"
  | "paved"
  | "paving_blocks"
  | "gravel"
  | "rough"
  | "grass"
  | "indoor"
  | "unknown";

export type LiftStatus = "operational" | "out_of_service" | "under_maintenance" | "unknown";

export interface RoutePrefs {
  avoidStairs: boolean;
  preferRamps: boolean;
  avoidSteepSlopes: boolean;
  avoidRoughSurfaces: boolean;
  avoidNarrowPaths: boolean;
  minimiseDistance: boolean;
  verifiedOnly: boolean;
}

export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  is_demo: boolean;
  verification_status: "verified" | "unverified";
  last_verified_at: string | null;
}

export interface GraphEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  name: string | null;
  distance_m: number;
  surface: SurfaceType;
  clear_width_m: number | null;
  slope_percent: number | null;
  has_steps: boolean | null;
  step_count: number | null;
  has_kerb: boolean | null;
  has_ramp: boolean;
  ramp_verified: boolean;
  lift_id: string | null;
  barrier_status: "clear" | "caution" | "blocked";
  barrier_note: string | null;
  classification: "accessible" | "limited" | "inaccessible" | "unknown";
  verification_status: "verified" | "unverified";
  last_verified_at: string | null;
  is_demo: boolean;
}

export interface GraphLift {
  id: string;
  label: string;
  status: LiftStatus;
  status_updated_at: string | null;
}

export interface RouteContext {
  now: Date;
  freshnessDays: number;
  liftFreshnessHours: number;
  /** edge ids with open (unresolved) barrier reports */
  reportedEdgeIds?: Set<string>;
  /** node ids with open (unresolved) barrier reports */
  reportedNodeIds?: Set<string>;
}

export interface EdgeEvaluation {
  allowed: boolean;
  /** why the edge was excluded (hard constraint) */
  exclusionReason?: string;
  /** multiplier applied to distance for the preference score */
  multiplier: number;
  /** things the user should know about this segment */
  concerns: string[];
  /** segment is missing data required to call it accessible */
  hasUnknowns: boolean;
  /** segment verification is current */
  verifiedFresh: boolean;
  stale: boolean;
}

export interface RouteSegment {
  edge: GraphEdge;
  from: GraphNode;
  to: GraphNode;
  evaluation: EdgeEvaluation;
  lift?: GraphLift;
}

export type RouteVerification = "verified" | "partially_verified" | "unverified";

export interface RouteResult {
  key: string;
  label: string;
  tags: string[];
  nodeIds: string[];
  segments: RouteSegment[];
  distanceM: number;
  timeMin: number;
  score: number;
  checkpoints: number;
  ramps: { name: string; verified: boolean; slope: number | null }[];
  lifts: { label: string; status: LiftStatus; updatedAt: string | null }[];
  stepCount: number;
  stepSegments: number;
  kerbs: number;
  surfaces: Record<string, number>;
  concerns: string[];
  verification: RouteVerification;
  isDemo: boolean;
  oldestVerification: string | null;
  directions: string[];
}

export interface FindRoutesResult {
  routes: RouteResult[];
  /** reasons edges were excluded, de-duplicated, for explaining "no route" */
  exclusionSummary: string[];
}
