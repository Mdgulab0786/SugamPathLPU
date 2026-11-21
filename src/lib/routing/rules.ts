import type { EdgeEvaluation, GraphEdge, GraphLift, MobilityMode, RouteContext, RoutePrefs } from "./types";

/** 1:12 ramp gradient — maximum generally accepted for wheelchair ramps. */
export const MAX_ACCESSIBLE_SLOPE = 8.33;
/** Above this gradient a slope is treated as "steep" for preference scoring. */
export const STEEP_SLOPE = 5;
/** Minimum clear width (m) for a wheelchair. */
export const MIN_WHEELCHAIR_WIDTH = 0.9;
/** Below this width (m) a pathway is considered narrow. */
export const NARROW_WIDTH = 1.2;

const ROUGH: ReadonlySet<string> = new Set(["gravel", "rough", "grass"]);

export const MODE_LABELS: Record<MobilityMode, string> = {
  wheelchair: "Wheelchair user (strict)",
  avoid_stairs: "Avoid stairs and steps",
  walking_aid: "Crutches or walking aid",
  temporary_injury: "Temporary injury",
  general: "General accessible walking",
};

/** walking speeds in metres per second, conservative estimates */
export const MODE_SPEED: Record<MobilityMode, number> = {
  wheelchair: 0.9,
  avoid_stairs: 1.0,
  walking_aid: 0.6,
  temporary_injury: 0.7,
  general: 1.1,
};

export const LIFT_WAIT_SECONDS = 60;
export const SECONDS_PER_STEP = 3;

export function defaultPrefs(mode: MobilityMode): RoutePrefs {
  return {
    avoidStairs: mode === "wheelchair" || mode === "avoid_stairs" || mode === "temporary_injury",
    preferRamps: mode === "wheelchair" || mode === "walking_aid",
    avoidSteepSlopes: mode === "walking_aid" || mode === "temporary_injury",
    avoidRoughSurfaces: mode === "wheelchair" || mode === "walking_aid" || mode === "temporary_injury",
    avoidNarrowPaths: mode === "wheelchair",
    minimiseDistance: false,
    verifiedOnly: mode === "wheelchair",
  };
}

export function isStale(lastVerifiedAt: string | null, ctx: RouteContext): boolean {
  if (!lastVerifiedAt) return true;
  const ageMs = ctx.now.getTime() - new Date(lastVerifiedAt).getTime();
  return ageMs > ctx.freshnessDays * 86_400_000;
}

export function liftConfirmedOperational(lift: GraphLift | undefined, ctx: RouteContext): "ok" | "stale" | "down" {
  if (!lift || lift.status !== "operational") return "down";
  if (!lift.status_updated_at) return "stale";
  const ageMs = ctx.now.getTime() - new Date(lift.status_updated_at).getTime();
  return ageMs > ctx.liftFreshnessHours * 3_600_000 ? "stale" : "ok";
}

/**
 * Hard constraints first (allowed=false), then a weighted preference multiplier.
 * Unknown accessibility data is never treated as accessible in strict wheelchair mode.
 */
export function evaluateEdge(
  edge: GraphEdge,
  mode: MobilityMode,
  prefs: RoutePrefs,
  ctx: RouteContext,
  lifts: Map<string, GraphLift>,
): EdgeEvaluation {
  const strict = mode === "wheelchair";
  const avoidStairs = strict || mode === "avoid_stairs" || prefs.avoidStairs;
  const concerns: string[] = [];
  let multiplier = 1;
  let hasUnknowns = false;
  const stale = edge.verification_status === "verified" && isStale(edge.last_verified_at, ctx);
  const verifiedFresh = edge.verification_status === "verified" && !stale;
  const deny = (reason: string): EdgeEvaluation => ({
    allowed: false,
    exclusionReason: reason,
    multiplier: Infinity,
    concerns,
    hasUnknowns,
    verifiedFresh,
    stale,
  });

  // --- Barriers ---
  if (edge.barrier_status === "blocked") return deny("Pathway is currently blocked");

  // --- Verification ---
  if (prefs.verifiedOnly && !verifiedFresh) {
    return deny(stale ? "Verification is out of date" : "Pathway is not verified");
  }
  if (edge.verification_status !== "verified") {
    concerns.push("Not verified");
    multiplier *= 1.25;
  } else if (stale) {
    concerns.push("Verification is out of date");
    multiplier *= 1.1;
  }

  // --- Classification ---
  if (edge.classification === "inaccessible") {
    if (strict || avoidStairs) return deny("Pathway is classified as inaccessible");
    concerns.push("Classified as inaccessible");
    multiplier *= 3;
  }

  // --- Steps ---
  if (edge.has_steps === true) {
    if (avoidStairs) return deny("Pathway has stairs or steps");
    const n = edge.step_count ?? 0;
    concerns.push(n > 0 ? `${n} steps` : "Steps");
    multiplier *= mode === "walking_aid" ? 2 + n * 0.1 : 1.3;
  } else if (edge.has_steps === null) {
    hasUnknowns = true;
    if (strict) return deny("Unknown whether pathway has steps");
    concerns.push("Steps not recorded");
    multiplier *= avoidStairs ? 1.5 : 1.15;
  }

  // --- Kerbs ---
  if (edge.has_kerb === true) {
    if (strict) return deny("Pathway has a kerb without a recorded dropped kerb");
    concerns.push("Kerb");
    multiplier *= 1.2;
  } else if (edge.has_kerb === null) {
    hasUnknowns = true;
    if (strict) return deny("Unknown whether pathway has a kerb");
    concerns.push("Kerb not recorded");
  }

  // --- Ramps ---
  if (edge.has_ramp && !edge.ramp_verified) {
    hasUnknowns = true;
    if (strict) return deny("Ramp has not been verified");
    concerns.push("Unverified ramp");
    multiplier *= 1.4;
  } else if (edge.has_ramp && edge.ramp_verified && prefs.preferRamps) {
    multiplier *= 0.85;
  }

  // --- Lifts ---
  if (edge.lift_id) {
    const lift = lifts.get(edge.lift_id);
    const state = liftConfirmedOperational(lift, ctx);
    if (state === "down") {
      const label = lift?.label ?? "Lift";
      const st = lift ? lift.status.replace(/_/g, " ") : "unknown";
      return deny(`${label} is ${st === "unknown" ? "of unknown status" : st}`);
    }
    if (state === "stale") {
      if (strict) return deny(`${lift?.label ?? "Lift"} status has not been confirmed recently`);
      concerns.push(`${lift?.label ?? "Lift"} status not confirmed recently`);
      multiplier *= 1.3;
    }
  }

  // --- Slope ---
  if (edge.slope_percent === null) {
    hasUnknowns = true;
    if (strict) return deny("Slope has not been measured");
    if (prefs.avoidSteepSlopes) concerns.push("Slope not measured");
  } else if (edge.slope_percent > MAX_ACCESSIBLE_SLOPE) {
    if (strict || prefs.avoidSteepSlopes) return deny(`Slope ${edge.slope_percent}% is steeper than 1:12`);
    concerns.push(`Steep slope ${edge.slope_percent}%`);
    multiplier *= 1.5;
  } else if (edge.slope_percent > STEEP_SLOPE) {
    if (prefs.avoidSteepSlopes) {
      concerns.push(`Moderate slope ${edge.slope_percent}%`);
      multiplier *= 1.4;
    }
  }

  // --- Surface ---
  if (edge.surface === "unknown") {
    hasUnknowns = true;
    if (strict) return deny("Surface has not been recorded");
    concerns.push("Surface not recorded");
  } else if (ROUGH.has(edge.surface)) {
    if (prefs.avoidRoughSurfaces) return deny(`Rough surface (${edge.surface})`);
    concerns.push(`Rough surface (${edge.surface})`);
    multiplier *= strict ? 2 : 1.3;
  }

  // --- Width ---
  if (edge.clear_width_m === null) {
    hasUnknowns = true;
    if (strict) return deny("Clear width has not been measured");
    if (prefs.avoidNarrowPaths) concerns.push("Width not measured");
  } else if (edge.clear_width_m < MIN_WHEELCHAIR_WIDTH) {
    if (strict || prefs.avoidNarrowPaths) return deny(`Pathway narrower than ${MIN_WHEELCHAIR_WIDTH} m`);
    concerns.push(`Narrow (${edge.clear_width_m} m)`);
    multiplier *= 1.3;
  } else if (edge.clear_width_m < NARROW_WIDTH && prefs.avoidNarrowPaths) {
    concerns.push(`Narrow (${edge.clear_width_m} m)`);
    multiplier *= 1.3;
  }

  // --- Caution / reports ---
  if (edge.barrier_status === "caution") {
    concerns.push(`Caution${edge.barrier_note ? `: ${edge.barrier_note}` : ""}`);
    multiplier *= 1.3;
  }
  if (ctx.reportedEdgeIds?.has(edge.id)) {
    concerns.push("Open barrier report on this pathway");
    multiplier *= 1.2;
  }

  if (prefs.minimiseDistance) multiplier = 1;

  return { allowed: true, multiplier, concerns, hasUnknowns, verifiedFresh, stale };
}
