import {
  LIFT_WAIT_SECONDS,
  MODE_SPEED,
  SECONDS_PER_STEP,
  evaluateEdge,
  isStale,
} from "./rules";
import type {
  EdgeEvaluation,
  FindRoutesResult,
  GraphEdge,
  GraphLift,
  GraphNode,
  MobilityMode,
  RouteContext,
  RoutePrefs,
  RouteResult,
  RouteSegment,
  RouteVerification,
} from "./types";

export * from "./types";
export * from "./rules";

export const NO_ROUTE_MESSAGE =
  "No verified accessible route is currently available for these locations. Please contact the campus support team or choose another destination.";

interface Adjacent {
  to: string;
  edgeId: string;
}

interface Graph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  evals: Map<string, EdgeEvaluation>;
  adj: Map<string, Adjacent[]>;
  lifts: Map<string, GraphLift>;
}

function buildGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  lifts: GraphLift[],
  mode: MobilityMode,
  prefs: RoutePrefs,
  ctx: RouteContext,
  exclusions: Set<string>,
): Graph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const liftMap = new Map(lifts.map((l) => [l.id, l]));
  const edgeMap = new Map<string, GraphEdge>();
  const evals = new Map<string, EdgeEvaluation>();
  const adj = new Map<string, Adjacent[]>();
  for (const e of edges) {
    if (!nodeMap.has(e.from_node_id) || !nodeMap.has(e.to_node_id)) continue;
    const ev = evaluateEdge(e, mode, prefs, ctx, liftMap);
    if (!ev.allowed) {
      if (ev.exclusionReason) exclusions.add(ev.exclusionReason);
      continue;
    }
    edgeMap.set(e.id, e);
    evals.set(e.id, ev);
    // pathways are traversable both ways
    for (const [a, b] of [
      [e.from_node_id, e.to_node_id],
      [e.to_node_id, e.from_node_id],
    ] as const) {
      const list = adj.get(a) ?? [];
      list.push({ to: b, edgeId: e.id });
      adj.set(a, list);
    }
  }
  return { nodes: nodeMap, edges: edgeMap, evals, adj, lifts: liftMap };
}

type WeightFn = (edge: GraphEdge, ev: EdgeEvaluation) => number;

interface Path {
  nodes: string[];
  edges: string[];
  cost: number;
}

/** Dijkstra with optional removed edges / nodes (used by Yen's algorithm). */
function dijkstra(
  g: Graph,
  start: string,
  goal: string,
  weight: WeightFn,
  removedEdges: Set<string> = new Set(),
  removedNodes: Set<string> = new Set(),
): Path | null {
  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, { node: string; edge: string }>();
  const visited = new Set<string>();
  // small graphs: simple O(V^2) frontier keeps the code dependency-free
  const frontier = new Set<string>([start]);
  while (frontier.size) {
    let u: string | null = null;
    let best = Infinity;
    for (const n of frontier) {
      const d = dist.get(n) ?? Infinity;
      if (d < best) {
        best = d;
        u = n;
      }
    }
    if (u === null) break;
    frontier.delete(u);
    if (u === goal) break;
    visited.add(u);
    for (const { to, edgeId } of g.adj.get(u) ?? []) {
      if (visited.has(to) || removedEdges.has(edgeId) || removedNodes.has(to)) continue;
      const e = g.edges.get(edgeId)!;
      const w = weight(e, g.evals.get(edgeId)!);
      const nd = best + w;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { node: u, edge: edgeId });
        frontier.add(to);
      }
    }
  }
  if (!dist.has(goal)) return null;
  const nodes = [goal];
  const edges: string[] = [];
  let cur = goal;
  while (cur !== start) {
    const p = prev.get(cur);
    if (!p) return null;
    edges.unshift(p.edge);
    nodes.unshift(p.node);
    cur = p.node;
  }
  return { nodes, edges, cost: dist.get(goal)! };
}

function pathCost(g: Graph, edges: string[], weight: WeightFn) {
  return edges.reduce((s, id) => s + weight(g.edges.get(id)!, g.evals.get(id)!), 0);
}

/** Yen's k-shortest loopless paths. */
function kShortest(g: Graph, start: string, goal: string, k: number, weight: WeightFn): Path[] {
  const first = dijkstra(g, start, goal, weight);
  if (!first) return [];
  const A: Path[] = [first];
  const B: Path[] = [];
  const key = (p: Path) => p.edges.join(">");
  for (let i = 1; i < k; i++) {
    const last = A[i - 1]!;
    for (let j = 0; j < last.nodes.length - 1; j++) {
      const spur = last.nodes[j]!;
      const rootNodes = last.nodes.slice(0, j + 1);
      const rootEdges = last.edges.slice(0, j);
      const removedEdges = new Set<string>();
      for (const p of A) {
        if (p.edges.slice(0, j).join(">") === rootEdges.join(">") && p.edges[j]) {
          removedEdges.add(p.edges[j]!);
        }
      }
      const removedNodes = new Set(rootNodes.slice(0, -1));
      const spurPath = dijkstra(g, spur, goal, weight, removedEdges, removedNodes);
      if (!spurPath) continue;
      const edges = [...rootEdges, ...spurPath.edges];
      const candidate: Path = {
        nodes: [...rootNodes.slice(0, -1), ...spurPath.nodes],
        edges,
        cost: pathCost(g, edges, weight),
      };
      if (!B.some((b) => key(b) === key(candidate)) && !A.some((a) => key(a) === key(candidate))) {
        B.push(candidate);
      }
    }
    if (!B.length) break;
    B.sort((a, b) => a.cost - b.cost);
    A.push(B.shift()!);
  }
  return A;
}

function bearing(a: GraphNode, b: GraphNode) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function compass(deg: number) {
  return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][
    Math.round(deg / 45) % 8
  ]!;
}

function turnWord(prev: number, next: number) {
  let d = next - prev;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  if (Math.abs(d) < 30) return "Continue straight";
  if (Math.abs(d) > 150) return "Turn around";
  if (d > 0) return d > 100 ? "Turn sharp right" : "Turn right";
  return d < -100 ? "Turn sharp left" : "Turn left";
}

const SURFACE_LABEL: Record<string, string> = {
  smooth_paved: "smooth paved",
  paved: "paved",
  paving_blocks: "paving-block",
  gravel: "gravel",
  rough: "rough",
  grass: "grass",
  indoor: "indoor",
  unknown: "unrecorded-surface",
};

export function buildDirections(segments: RouteSegment[]): string[] {
  if (!segments.length) return [];
  const steps: string[] = [`Start at ${segments[0]!.from.name}.`];
  let prevBearing: number | null = null;
  for (const s of segments) {
    const b = bearing(s.from, s.to);
    const dist = Math.round(Number(s.edge.distance_m));
    let line: string;
    if (s.edge.lift_id) {
      line = `Take ${s.lift?.label ?? "the lift"} to ${s.to.name}.`;
    } else {
      const lead = prevBearing === null ? `Head ${compass(b)}` : turnWord(prevBearing, b);
      const via = s.edge.name ? ` along ${s.edge.name}` : "";
      line = `${lead} and continue ${dist} m${via} on the ${SURFACE_LABEL[s.edge.surface] ?? s.edge.surface} path to ${s.to.name}.`;
    }
    const extras: string[] = [];
    if (s.edge.has_ramp) {
      extras.push(
        `This section uses a ${s.edge.ramp_verified ? "verified" : "NOT verified"} ramp${
          s.edge.slope_percent !== null ? ` (gradient ${s.edge.slope_percent}%)` : ""
        }.`,
      );
    }
    if (s.edge.has_steps) extras.push(`Caution: ${s.edge.step_count ?? "some"} steps on this section.`);
    if (s.edge.has_kerb) extras.push("Caution: kerb on this section.");
    if (s.edge.barrier_status === "caution") extras.push(`Caution: ${s.edge.barrier_note ?? "reported hazard"}.`);
    if (s.edge.verification_status !== "verified") extras.push("This section has not been verified.");
    steps.push([line, ...extras].join(" "));
    if (!s.edge.lift_id) prevBearing = b;
  }
  steps.push(`You have arrived at ${segments[segments.length - 1]!.to.name}.`);
  return steps;
}

function summarise(
  g: Graph,
  path: Path,
  mode: MobilityMode,
  ctx: RouteContext,
  key: string,
  label: string,
): RouteResult {
  const segments: RouteSegment[] = path.edges.map((id, i) => {
    const edge = g.edges.get(id)!;
    const from = g.nodes.get(path.nodes[i]!)!;
    const to = g.nodes.get(path.nodes[i + 1]!)!;
    const seg: RouteSegment = { edge, from, to, evaluation: g.evals.get(id)! };
    const lift = edge.lift_id ? g.lifts.get(edge.lift_id) : undefined;
    if (lift) seg.lift = lift;
    return seg;
  });
  let distance = 0;
  let stepCount = 0;
  let stepSegments = 0;
  let kerbs = 0;
  let seconds = 0;
  const surfaces: Record<string, number> = {};
  const concerns = new Set<string>();
  const ramps: RouteResult["ramps"] = [];
  const lifts: RouteResult["lifts"] = [];
  let allVerified = true;
  let anyVerified = false;
  let anyUnknown = false;
  let oldest: string | null = null;
  let isDemo = false;
  for (const s of segments) {
    const d = Number(s.edge.distance_m);
    distance += d;
    seconds += d / MODE_SPEED[mode];
    surfaces[s.edge.surface] = (surfaces[s.edge.surface] ?? 0) + d;
    if (s.edge.has_steps) {
      stepSegments++;
      stepCount += s.edge.step_count ?? 0;
      seconds += (s.edge.step_count ?? 5) * SECONDS_PER_STEP;
    }
    if (s.edge.has_kerb) kerbs++;
    if (s.edge.has_ramp) {
      ramps.push({ name: s.edge.name ?? "Ramp", verified: s.edge.ramp_verified, slope: s.edge.slope_percent });
    }
    if (s.lift) {
      lifts.push({ label: s.lift.label, status: s.lift.status, updatedAt: s.lift.status_updated_at });
      seconds += LIFT_WAIT_SECONDS;
    }
    for (const c of s.evaluation.concerns) concerns.add(`${s.edge.name ?? "Segment"}: ${c}`);
    if (s.evaluation.verifiedFresh) anyVerified = true;
    else allVerified = false;
    if (s.evaluation.hasUnknowns) anyUnknown = true;
    if (s.edge.last_verified_at && (!oldest || s.edge.last_verified_at < oldest)) oldest = s.edge.last_verified_at;
    if (!s.edge.last_verified_at) oldest = oldest ?? null;
    if (s.edge.is_demo || s.from.is_demo || s.to.is_demo) isDemo = true;
  }
  for (const nid of path.nodes) {
    if (ctx.reportedNodeIds?.has(nid)) concerns.add(`${g.nodes.get(nid)!.name}: open barrier report`);
  }
  const verification: RouteVerification =
    allVerified && !anyUnknown ? "verified" : anyVerified ? "partially_verified" : "unverified";
  return {
    key,
    label,
    tags: [],
    nodeIds: path.nodes,
    segments,
    distanceM: Math.round(distance),
    timeMin: Math.max(1, Math.round(seconds / 60)),
    score: Math.round(path.cost),
    checkpoints: Math.max(0, path.nodes.length - 2),
    ramps,
    lifts,
    stepCount,
    stepSegments,
    kerbs,
    surfaces,
    concerns: [...concerns],
    verification,
    isDemo,
    oldestVerification: allVerified ? oldest : segments.some((s) => !s.edge.last_verified_at) ? null : oldest,
    directions: buildDirections(segments),
  };
}

export interface FindRoutesInput {
  nodes: GraphNode[];
  edges: GraphEdge[];
  lifts: GraphLift[];
  startId: string;
  goalId: string;
  mode: MobilityMode;
  prefs: RoutePrefs;
  ctx: RouteContext;
}

/**
 * Returns up to three routes: best accessible (lowest weighted score),
 * an alternative (next-best loopless path), and the shortest route that
 * still satisfies every hard constraint.
 */
export function findRoutes(input: FindRoutesInput): FindRoutesResult {
  const { nodes, edges, lifts, startId, goalId, mode, prefs, ctx } = input;
  const exclusions = new Set<string>();
  const g = buildGraph(nodes, edges, lifts, mode, prefs, ctx, exclusions);
  if (startId === goalId || !g.nodes.has(startId) || !g.nodes.has(goalId)) {
    return { routes: [], exclusionSummary: [] };
  }
  const weighted: WeightFn = (e, ev) => Number(e.distance_m) * ev.multiplier + (e.lift_id ? 30 : 0);
  const byDistance: WeightFn = (e) => Number(e.distance_m);

  const best = kShortest(g, startId, goalId, 2, weighted);
  const shortest = dijkstra(g, startId, goalId, byDistance);
  if (!best.length || !shortest) {
    return { routes: [], exclusionSummary: [...exclusions] };
  }
  const routes: RouteResult[] = [];
  const key = (p: Path) => p.edges.join(">");
  routes.push(summarise(g, best[0]!, mode, ctx, "best", "Best accessible route"));
  if (best[1]) routes.push(summarise(g, best[1], mode, ctx, "alternative", "Alternative route"));
  const dup = routes.find((r) => r.segments.map((s) => s.edge.id).join(">") === key(shortest));
  if (dup) {
    dup.tags.push("Also the shortest suitable route");
  } else {
    const sp = { ...shortest, cost: pathCost(g, shortest.edges, weighted) };
    routes.push(summarise(g, sp, mode, ctx, "shortest", "Shortest suitable route"));
  }
  return { routes, exclusionSummary: [...exclusions] };
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export { isStale };
