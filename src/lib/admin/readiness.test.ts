import { describe, expect, it } from "vitest";
import { computeReadiness } from "./readiness";
import type { NodeRow, EdgeRow, LiftRow, SettingsRow } from "@/lib/db-types";

// Synthetic fixtures only; these do not describe LPU places or measurements.
const now = new Date("2025-01-15T12:00:00Z");
const settings = { demo_mode: false, verification_freshness_days: 30, lift_status_freshness_hours: 24 } as SettingsRow;
const node = (id: string, extra: Partial<NodeRow> = {}) => ({ id, name: `Synthetic ${id}`, kind: "destination", is_destination: true, lat: 0, lng: 0, is_demo: false, last_verified_at: now.toISOString(), verification_status: "verified", ...extra }) as NodeRow;
const edge = (extra: Partial<EdgeRow> = {}) => ({ id: "synthetic-edge", from_node_id: "a", to_node_id: "b", is_demo: false, has_steps: false, has_kerb: false, slope_percent: 0, clear_width_m: 2, surface: "paved", barrier_status: "clear", verification_status: "verified", last_verified_at: now.toISOString(), lift_id: null, ...extra }) as EdgeRow;
const check = (nodes: NodeRow[], edges: EdgeRow[], lifts: LiftRow[] = [], s = settings) => computeReadiness(nodes, edges, lifts, s, now);
const status = (items: ReturnType<typeof check>, id: string) => items.find(i => i.id === id)?.status;
describe("computeReadiness", () => {
  it("fails closed for an empty graph", () => {
    const result = check([], []);
    for (const id of ["locations", "surveyed", "attributes", "freshness", "connectivity"]) expect(status(result, id)).toBe("fail");
  });
  it("passes a complete synthetic graph", () => {
    expect(check([node("a"), node("b")], [edge()]).every(i => i.status === "pass")).toBe(true);
  });
  it("does not count demo data", () => {
    expect(status(check([node("a", { is_demo: true })], [edge({ is_demo: true })]), "locations")).toBe("fail");
  });
  it("rejects unknown attributes and unverified edges", () => {
    const result = check([node("a"), node("b")], [edge({ has_steps: null, verification_status: "unverified" })]);
    expect(status(result, "attributes")).toBe("fail");
    expect(status(result, "surveyed")).toBe("fail");
  });
  it.each([null, "invalid", "2026-01-01", "2020-01-01"])("rejects invalid or stale dates: %s", date => {
    expect(status(check([node("a", { last_verified_at: date })], []), "freshness")).toBe("fail");
  });
  it("does not connect through blocked or demo edges", () => {
    for (const e of [edge({ barrier_status: "blocked" }), edge({ is_demo: true })]) {
      const result = check([node("a"), node("b")], [e]);
      expect(status(result, "connectivity")).toBe("fail");
      expect(result.find(i => i.id === "connectivity")?.detail).toContain("Synthetic b");
    }
  });
  it("rejects dangling endpoints and missing lift references", () => {
    const result = check([node("a")], [edge({ lift_id: "missing" })]);
    expect(status(result, "connectivity")).toBe("fail");
    expect(status(result, "lifts")).toBe("fail");
  });
  it("warns when demo mode remains on", () => {
    expect(status(check([], [], [], { ...settings, demo_mode: true }), "demo")).toBe("warn");
  });
  it("rejects invalid coordinates", () => {
    expect(status(check([node("a", { lat: NaN })], []), "locations")).toBe("fail");
  });
  it("rejects stale lift statuses", () => {
    const lift = { id: "lift", is_demo: false, status: "operational", status_updated_at: "2020-01-01" } as LiftRow;
    expect(status(check([], [], [lift]), "lifts")).toBe("fail");
  });
});
