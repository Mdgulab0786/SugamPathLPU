import { describe, expect, it } from "vitest";
import { NO_ROUTE_MESSAGE, defaultPrefs, findRoutes } from "./engine";
import type { GraphEdge, GraphLift, GraphNode, MobilityMode } from "./types";

const NOW = new Date("2026-11-20T12:00:00Z");
const RECENT = "2026-11-01T00:00:00Z";
const ctx = { now: NOW, freshnessDays: 180, liftFreshnessHours: 24 };

function node(id: string, lat = 31.25, lng = 75.7): GraphNode {
  return { id, name: `Node ${id}`, kind: "junction", lat, lng, is_demo: false, verification_status: "verified", last_verified_at: RECENT };
}

function edge(id: string, from: string, to: string, over: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id, from_node_id: from, to_node_id: to, name: id, distance_m: 100, surface: "smooth_paved",
    clear_width_m: 2, slope_percent: 2, has_steps: false, step_count: 0, has_kerb: false,
    has_ramp: false, ramp_verified: false, lift_id: null, barrier_status: "clear", barrier_note: null,
    classification: "accessible", verification_status: "verified", last_verified_at: RECENT, is_demo: false,
    ...over,
  };
}

const nodes = ["S", "A", "B", "C", "G"].map((id, i) => node(id, 31.25 + i * 0.001, 75.7 + (i % 2) * 0.001));

function run(edges: GraphEdge[], mode: MobilityMode = "wheelchair", lifts: GraphLift[] = [], prefsOver = {}) {
  return findRoutes({ nodes, edges, lifts, startId: "S", goalId: "G", mode, prefs: { ...defaultPrefs(mode), ...prefsOver }, ctx });
}

const ids = (r: { segments: { edge: { id: string } }[] }) => r.segments.map((s) => s.edge.id);

describe("routing engine", () => {
  it("strict wheelchair mode never uses a route containing stairs", () => {
    const edges = [
      edge("SA", "S", "A", { distance_m: 50 }),
      edge("AG-steps", "A", "G", { distance_m: 50, has_steps: true, step_count: 10, classification: "inaccessible" }),
      edge("SB", "S", "B", { distance_m: 200 }),
      edge("BG", "B", "G", { distance_m: 200 }),
    ];
    const res = run(edges, "wheelchair");
    expect(res.routes.length).toBeGreaterThan(0);
    for (const r of res.routes) expect(ids(r)).not.toContain("AG-steps");
    expect(ids(res.routes[0]!)).toEqual(["SB", "BG"]);
  });

  it("general walking mode may use the stepped shortcut when stairs are allowed", () => {
    const edges = [
      edge("SA", "S", "A", { distance_m: 50 }),
      edge("AG-steps", "A", "G", { distance_m: 50, has_steps: true, step_count: 4 }),
      edge("SB", "S", "B", { distance_m: 200 }),
      edge("BG", "B", "G", { distance_m: 200 }),
    ];
    const res = run(edges, "general");
    expect(ids(res.routes[0]!)).toEqual(["SA", "AG-steps"]);
    expect(res.routes[0]!.stepCount).toBe(4);
  });

  it("excludes a blocked pathway in every mode", () => {
    const edges = [
      edge("SG-blocked", "S", "G", { distance_m: 10, barrier_status: "blocked" }),
      edge("SB", "S", "B"),
      edge("BG", "B", "G"),
    ];
    for (const mode of ["wheelchair", "avoid_stairs", "walking_aid", "temporary_injury", "general"] as const) {
      const res = run(edges, mode);
      for (const r of res.routes) expect(ids(r)).not.toContain("SG-blocked");
    }
  });

  it("drops routes that depend on a lift that is out of service and recalculates", () => {
    const lift: GraphLift = { id: "L1", label: "Lift 1", status: "operational", status_updated_at: "2026-11-20T10:00:00Z" };
    const edges = [
      edge("SC", "S", "C", { distance_m: 30 }),
      edge("CG-lift", "C", "G", { distance_m: 20, lift_id: "L1" }),
      edge("SB", "S", "B", { distance_m: 300 }),
      edge("BG", "B", "G", { distance_m: 300 }),
    ];
    const up = run(edges, "wheelchair", [lift]);
    expect(ids(up.routes[0]!)).toEqual(["SC", "CG-lift"]);
    expect(up.routes[0]!.lifts[0]!.label).toBe("Lift 1");

    const down = run(edges, "wheelchair", [{ ...lift, status: "out_of_service" }]);
    for (const r of down.routes) expect(ids(r)).not.toContain("CG-lift");
    expect(ids(down.routes[0]!)).toEqual(["SB", "BG"]);
  });

  it("strict mode does not use a lift whose operational status has not been confirmed recently", () => {
    const lift: GraphLift = { id: "L1", label: "Lift 1", status: "operational", status_updated_at: "2026-11-10T10:00:00Z" };
    const edges = [edge("SC", "S", "C"), edge("CG-lift", "C", "G", { lift_id: "L1" })];
    expect(run(edges, "wheelchair", [lift]).routes).toHaveLength(0);
  });

  it("does not treat an unverified ramp as safe in strict wheelchair mode", () => {
    const edges = [
      edge("SA", "S", "A", { distance_m: 40 }),
      edge("AG-ramp", "A", "G", { distance_m: 40, has_ramp: true, ramp_verified: false }),
    ];
    const strict = run(edges, "wheelchair");
    expect(strict.routes).toHaveLength(0);
    expect(strict.exclusionSummary).toContain("Ramp has not been verified");

    const avoid = run(edges, "avoid_stairs");
    expect(avoid.routes).toHaveLength(1);
    expect(avoid.routes[0]!.concerns.join(" ")).toMatch(/Unverified ramp/);
    expect(avoid.routes[0]!.verification).not.toBe("verified");
  });

  it("returns two alternative accessible routes when both exist", () => {
    const edges = [
      edge("SA", "S", "A", { distance_m: 100 }),
      edge("AG", "A", "G", { distance_m: 100 }),
      edge("SB", "S", "B", { distance_m: 150 }),
      edge("BG", "B", "G", { distance_m: 150 }),
    ];
    const res = run(edges, "wheelchair");
    expect(res.routes).toHaveLength(2);
    expect(ids(res.routes[0]!)).toEqual(["SA", "AG"]);
    expect(ids(res.routes[1]!)).toEqual(["SB", "BG"]);
    expect(res.routes[0]!.tags).toContain("Also the shortest suitable route");
    expect(res.routes.every((r) => r.verification === "verified")).toBe(true);
  });

  it("returns no route (and the safety message exists) when nothing accessible connects", () => {
    const edges = [edge("SG-steps", "S", "G", { has_steps: true, step_count: 8, classification: "inaccessible" })];
    const res = run(edges, "wheelchair");
    expect(res.routes).toHaveLength(0);
    expect(res.exclusionSummary.length).toBeGreaterThan(0);
    expect(NO_ROUTE_MESSAGE).toMatch(/No verified accessible route is currently available/);
  });

  it("treats unknown step data as not accessible in strict mode", () => {
    const edges = [edge("SG", "S", "G", { has_steps: null })];
    expect(run(edges, "wheelchair").routes).toHaveLength(0);
    const general = run(edges, "general");
    expect(general.routes).toHaveLength(1);
    expect(general.routes[0]!.verification).not.toBe("verified");
  });

  it("never labels a route verified when a segment's verification is stale", () => {
    const edges = [edge("SG", "S", "G", { last_verified_at: "2025-01-01T00:00:00Z" })];
    const res = run(edges, "general", [], { verifiedOnly: false });
    expect(res.routes[0]!.verification).not.toBe("verified");
    expect(run(edges, "general", [], { verifiedOnly: true }).routes).toHaveLength(0);
  });

  it("produces written directions from start to destination", () => {
    const edges = [edge("SA", "S", "A"), edge("AG", "A", "G")];
    const r = run(edges, "wheelchair").routes[0]!;
    expect(r.directions[0]).toBe("Start at Node S.");
    expect(r.directions.at(-1)).toBe("You have arrived at Node G.");
    expect(r.directions).toHaveLength(4);
  });
});
