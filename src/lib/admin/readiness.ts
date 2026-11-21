import type { NodeRow, EdgeRow, LiftRow, SettingsRow } from "@/lib/db-types";

export interface ReadinessItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export function computeReadiness(
  nodes: readonly NodeRow[], edges: readonly EdgeRow[],
  lifts: readonly LiftRow[], settings: SettingsRow, now: Date,
): ReadinessItem[] {
  const realNodes = nodes.filter(n => !n.is_demo);
  const realEdges = edges.filter(e => !e.is_demo);
  const realLifts = lifts.filter(l => !l.is_demo);
  const ids = new Set(realNodes.map(n => n.id));
  const validEdges = realEdges.filter(e => ids.has(e.from_node_id) && ids.has(e.to_node_id));
  const fresh = (value: string | null, milliseconds: number) => {
    if (!value || !Number.isFinite(milliseconds) || milliseconds <= 0) return false;
    const age = now.getTime() - Date.parse(value);
    return Number.isFinite(age) && age >= 0 && age <= milliseconds;
  };
  const item = (id: string, label: string, ok: boolean, detail: string): ReadinessItem =>
    ({ id, label, status: ok ? "pass" : "fail", detail });
  const coordinatesValid = realNodes.length > 0 && realNodes.every(n =>
    Number.isFinite(n.lat) && Math.abs(n.lat) <= 90 &&
    Number.isFinite(n.lng) && Math.abs(n.lng) <= 180);
  const surveyed = realEdges.filter(e => e.verification_status === "verified").length;
  const attributes = realEdges.filter(e => e.has_steps !== null && e.has_kerb !== null &&
    e.slope_percent !== null && Number.isFinite(e.slope_percent) &&
    e.clear_width_m !== null && Number.isFinite(e.clear_width_m) && e.clear_width_m > 0 &&
    e.surface !== "unknown").length;
  const dated = [...realNodes, ...realEdges];
  const freshCount = dated.filter(r => fresh(r.last_verified_at,
    settings.verification_freshness_days * 86_400_000)).length;
  const destinations = realNodes.filter(n => n.is_destination || n.kind === "destination");
  const adjacency = new Map<string, string[]>();
  for (const edge of validEdges) {
    if (edge.barrier_status === "blocked") continue;
    for (const [a, b] of [[edge.from_node_id, edge.to_node_id], [edge.to_node_id, edge.from_node_id]] as const) {
      const neighbors = adjacency.get(a) ?? [];
      neighbors.push(b);
      adjacency.set(a, neighbors);
    }
  }
  const visited = new Set<string>();
  const first = destinations[0];
  const queue = first ? [first.id] : [];
  while (queue.length) {
    const id = queue.pop();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    queue.push(...(adjacency.get(id) ?? []).filter(next => !visited.has(next)));
  }
  const disconnected = destinations.filter(n => !visited.has(n.id));
  const unknownLifts = realLifts.filter(l => l.status === "unknown" ||
    !fresh(l.status_updated_at, settings.lift_status_freshness_hours * 3_600_000));
  const missingLifts = realEdges.filter(e => e.lift_id && !realLifts.some(l => l.id === e.lift_id));
  const nonoperational = realLifts.filter(l => l.status !== "operational");
  const liftStatus: ReadinessItem["status"] = unknownLifts.length || missingLifts.length ? "fail"
    : nonoperational.length ? "warn" : "pass";
  return [
    item("locations", "Real locations have valid coordinates", coordinatesValid,
      `${realNodes.length} non-demo locations; every coordinate must be finite and in range.`),
    item("surveyed", "Required route segments are surveyed", realEdges.length > 0 && surveyed === realEdges.length,
      `${surveyed}/${realEdges.length} non-demo segments verified (${realEdges.length ? Math.round(surveyed / realEdges.length * 100) : 0}%). All non-demo segments are treated as required.`),
    item("attributes", "Accessibility attributes are recorded", realEdges.length > 0 && attributes === realEdges.length,
      `${attributes}/${realEdges.length} segments have steps, kerb, slope, positive width and a known surface recorded.`),
    item("freshness", "Verification dates are present and fresh", dated.length > 0 && freshCount === dated.length,
      `${freshCount}/${dated.length} locations and segments have valid, non-future survey dates within ${settings.verification_freshness_days} days.`),
    item("connectivity", "Destinations share a non-blocked route network",
      destinations.length > 0 && disconnected.length === 0 && validEdges.length === realEdges.length,
      !destinations.length ? "No real destinations recorded." :
        `${disconnected.length ? `Disconnected: ${disconnected.map(n => `${n.name} (${n.id})`).join(", ")}.` : "All real destinations connected."} ${realEdges.length - validEdges.length} segments have missing or demo endpoints. Connectivity alone does not certify accessibility.`),
    { id: "lifts", label: "Lift statuses are known and current", status: liftStatus,
      detail: `${unknownLifts.length} unknown/stale statuses; ${missingLifts.length} missing or demo lift references; ${nonoperational.length} non-operational or unknown lifts. ${realLifts.length ? "" : "No real lifts recorded; confirm survey coverage."}` },
    { id: "demo", label: "Demo mode is disabled", status: settings.demo_mode ? "warn" : "pass",
      detail: settings.demo_mode ? "Demo mode is still enabled. Synthetic records are excluded from this checklist." : "Demo records are hidden from public campus data." },
  ];
}
