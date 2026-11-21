import Papa from "papaparse";
import { haversineMeters } from "@/lib/routing/engine";
import type { EdgeRow, NodeRow } from "@/lib/db-types";

export const NODE_KINDS = ["building", "entrance", "junction", "lift", "ramp", "checkpoint", "destination", "other"] as const;
export const SURFACES = ["smooth_paved", "paved", "paving_blocks", "gravel", "rough", "grass", "indoor", "unknown"] as const;
export const CLASSES = ["accessible", "limited", "inaccessible", "unknown"] as const;
export const BARRIERS = ["clear", "caution", "blocked"] as const;

export interface NodeInput {
  ref: string | null;
  name: string;
  kind: (typeof NODE_KINDS)[number];
  lat: number;
  lng: number;
  description: string | null;
  is_destination: boolean;
  accessible_entrance: boolean | null;
}

export interface EdgeInput {
  from_ref: string | null;
  to_ref: string | null;
  from_coord: [number, number] | null; // [lat, lng]
  to_coord: [number, number] | null;
  name: string | null;
  distance_m: number | null;
  surface: (typeof SURFACES)[number];
  clear_width_m: number | null;
  slope_percent: number | null;
  has_steps: boolean | null;
  step_count: number | null;
  has_kerb: boolean | null;
  has_ramp: boolean;
  classification: (typeof CLASSES)[number];
  barrier_status: (typeof BARRIERS)[number];
  notes: string | null;
}

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult<T> {
  rows: T[];
  errors: ParseError[];
}

export const NODE_COLUMNS = ["ref", "name", "kind", "lat", "lng", "description", "is_destination", "accessible_entrance"];
export const EDGE_COLUMNS = [
  "from_ref", "to_ref", "name", "distance_m", "surface", "clear_width_m", "slope_percent", "has_steps",
  "step_count", "has_kerb", "has_ramp", "classification", "barrier_status", "notes",
];
export const AUDIT_COLUMNS = [
  "edge_ref_or_id", "from_place", "to_place", "surveyed_on", "surveyor_role", "surface", "clear_width_m",
  "slope_percent", "has_steps", "step_count", "has_kerb", "has_ramp", "ramp_condition", "lift_label",
  "barrier_notes", "photo_reference", "observations",
];

export function templateCsv(columns: string[]) {
  return columns.join(",") + "\n";
}

export function triState(v: unknown): boolean | null | "invalid" {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "" || s === "unknown" || s === "not recorded" || s === "null") return null;
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return "invalid";
}

function num(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : "invalid";
}

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function oneOf<T extends readonly string[]>(v: unknown, list: T, fallback: T[number]): T[number] | "invalid" {
  const s = text(v)?.toLowerCase();
  if (!s) return fallback;
  return (list as readonly string[]).includes(s) ? (s as T[number]) : "invalid";
}

export function normaliseNode(raw: Record<string, unknown>, row: number, errors: ParseError[]): NodeInput | null {
  const name = text(raw["name"]);
  const lat = num(raw["lat"]);
  const lng = num(raw["lng"]);
  const kind = oneOf(raw["kind"], NODE_KINDS, "junction");
  const isDest = triState(raw["is_destination"]);
  const acc = triState(raw["accessible_entrance"]);
  const errs: string[] = [];
  if (!name) errs.push("name is required");
  if (lat === null || lat === "invalid" || lat < -90 || lat > 90) errs.push("lat must be a number between -90 and 90");
  if (lng === null || lng === "invalid" || lng < -180 || lng > 180) errs.push("lng must be a number between -180 and 180");
  if (kind === "invalid") errs.push(`kind must be one of ${NODE_KINDS.join(", ")}`);
  if (isDest === "invalid") errs.push("is_destination must be yes/no");
  if (acc === "invalid") errs.push("accessible_entrance must be yes/no/unknown");
  if (errs.length) {
    errors.push({ row, message: errs.join("; ") });
    return null;
  }
  return {
    ref: text(raw["ref"]),
    name: name!,
    kind: kind as NodeInput["kind"],
    lat: lat as number,
    lng: lng as number,
    description: text(raw["description"]),
    is_destination: isDest === true,
    accessible_entrance: acc as boolean | null,
  };
}

export function normaliseEdge(raw: Record<string, unknown>, row: number, errors: ParseError[]): EdgeInput | null {
  const errs: string[] = [];
  const dist = num(raw["distance_m"]);
  const width = num(raw["clear_width_m"]);
  const slope = num(raw["slope_percent"]);
  const steps = triState(raw["has_steps"]);
  const stepCount = num(raw["step_count"]);
  const kerb = triState(raw["has_kerb"]);
  const ramp = triState(raw["has_ramp"]);
  const surface = oneOf(raw["surface"], SURFACES, "unknown");
  const cls = oneOf(raw["classification"], CLASSES, "unknown");
  const barrier = oneOf(raw["barrier_status"], BARRIERS, "clear");
  const fromRef = text(raw["from_ref"]);
  const toRef = text(raw["to_ref"]);
  const fromCoord = (raw["__from_coord"] as [number, number] | undefined) ?? null;
  const toCoord = (raw["__to_coord"] as [number, number] | undefined) ?? null;
  if (!fromRef && !fromCoord) errs.push("from_ref is required");
  if (!toRef && !toCoord) errs.push("to_ref is required");
  if (fromRef && toRef && fromRef === toRef) errs.push("from_ref and to_ref must differ");
  if (dist === "invalid" || (typeof dist === "number" && dist <= 0)) errs.push("distance_m must be a positive number");
  if (width === "invalid" || (typeof width === "number" && width <= 0)) errs.push("clear_width_m must be a positive number");
  if (slope === "invalid" || (typeof slope === "number" && (slope < 0 || slope > 100))) errs.push("slope_percent must be 0–100");
  if (steps === "invalid") errs.push("has_steps must be yes/no/unknown");
  if (kerb === "invalid") errs.push("has_kerb must be yes/no/unknown");
  if (ramp === "invalid") errs.push("has_ramp must be yes/no");
  if (stepCount === "invalid" || (typeof stepCount === "number" && stepCount < 0)) errs.push("step_count must be 0 or more");
  if (surface === "invalid") errs.push(`surface must be one of ${SURFACES.join(", ")}`);
  if (cls === "invalid") errs.push(`classification must be one of ${CLASSES.join(", ")}`);
  if (barrier === "invalid") errs.push(`barrier_status must be one of ${BARRIERS.join(", ")}`);
  if (errs.length) {
    errors.push({ row, message: errs.join("; ") });
    return null;
  }
  return {
    from_ref: fromRef,
    to_ref: toRef,
    from_coord: fromCoord,
    to_coord: toCoord,
    name: text(raw["name"]),
    distance_m: dist as number | null,
    surface: surface as EdgeInput["surface"],
    clear_width_m: width as number | null,
    slope_percent: slope as number | null,
    has_steps: steps as boolean | null,
    step_count: stepCount as number | null,
    has_kerb: kerb as boolean | null,
    has_ramp: ramp === true,
    classification: cls as EdgeInput["classification"],
    barrier_status: barrier as EdgeInput["barrier_status"],
    notes: text(raw["notes"]),
  };
}

function parseCsv(textIn: string) {
  return Papa.parse<Record<string, string>>(textIn.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
}

export function parseNodesCsv(csv: string): ParseResult<NodeInput> {
  const errors: ParseError[] = [];
  const res = parseCsv(csv);
  if (!res.meta.fields?.includes("name")) return { rows: [], errors: [{ row: 1, message: "Missing header row with at least: name, lat, lng" }] };
  const rows = res.data.map((r, i) => normaliseNode(r, i + 2, errors)).filter((x): x is NodeInput => !!x);
  return { rows, errors };
}

export function parseEdgesCsv(csv: string): ParseResult<EdgeInput> {
  const errors: ParseError[] = [];
  const res = parseCsv(csv);
  if (!res.meta.fields?.includes("from_ref")) return { rows: [], errors: [{ row: 1, message: "Missing header row with at least: from_ref, to_ref" }] };
  const rows = res.data.map((r, i) => normaliseEdge(r, i + 2, errors)).filter((x): x is EdgeInput => !!x);
  return { rows, errors };
}

export function parseGeoJson(json: string): { nodes: ParseResult<NodeInput>; edges: ParseResult<EdgeInput> } {
  const nodeErrors: ParseError[] = [];
  const edgeErrors: ParseError[] = [];
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return { nodes: { rows: [], errors: [{ row: 0, message: "File is not valid JSON" }] }, edges: { rows: [], errors: [] } };
  }
  const features = (doc as { type?: string; features?: unknown[] })?.features;
  if ((doc as { type?: string })?.type !== "FeatureCollection" || !Array.isArray(features)) {
    return { nodes: { rows: [], errors: [{ row: 0, message: "Expected a GeoJSON FeatureCollection" }] }, edges: { rows: [], errors: [] } };
  }
  const nodes: NodeInput[] = [];
  const edges: EdgeInput[] = [];
  features.forEach((f, i) => {
    const feat = f as { geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> };
    const props = feat.properties ?? {};
    const g = feat.geometry;
    const row = i + 1;
    if (g?.type === "Point" && Array.isArray(g.coordinates)) {
      const [lng, lat] = g.coordinates as number[];
      const n = normaliseNode({ ...props, lat, lng }, row, nodeErrors);
      if (n) nodes.push(n);
    } else if (g?.type === "LineString" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      const coords = g.coordinates as number[][];
      const first = coords[0]!;
      const last = coords[coords.length - 1]!;
      let length = 0;
      for (let k = 1; k < coords.length; k++) {
        length += haversineMeters({ lat: coords[k - 1]![1]!, lng: coords[k - 1]![0]! }, { lat: coords[k]![1]!, lng: coords[k]![0]! });
      }
      const e = normaliseEdge(
        {
          ...props,
          distance_m: props["distance_m"] ?? Math.round(length * 10) / 10,
          __from_coord: [first[1], first[0]],
          __to_coord: [last[1], last[0]],
        },
        row,
        edgeErrors,
      );
      if (e) edges.push(e);
    } else {
      nodeErrors.push({ row, message: `Unsupported geometry ${g?.type ?? "missing"} (use Point or LineString)` });
    }
  });
  return { nodes: { rows: nodes, errors: nodeErrors }, edges: { rows: edges, errors: edgeErrors } };
}

export interface ResolvedEdge {
  from_node_id: string;
  to_node_id: string;
  name: string | null;
  distance_m: number;
  surface: EdgeInput["surface"];
  clear_width_m: number | null;
  slope_percent: number | null;
  has_steps: boolean | null;
  step_count: number | null;
  has_kerb: boolean | null;
  has_ramp: boolean;
  classification: EdgeInput["classification"];
  barrier_status: EdgeInput["barrier_status"];
  notes: string | null;
}

const MATCH_RADIUS_M = 5;

/** Resolve refs / endpoint coordinates to node ids. */
export function resolveEdges(edges: EdgeInput[], nodes: Pick<NodeRow, "id" | "ref" | "lat" | "lng">[]): ParseResult<ResolvedEdge> {
  const byRef = new Map(nodes.filter((n) => n.ref).map((n) => [n.ref!.toLowerCase(), n]));
  const errors: ParseError[] = [];
  const rows: ResolvedEdge[] = [];
  const nearest = (c: [number, number]) => {
    let best: (typeof nodes)[number] | null = null;
    let bestD = Infinity;
    for (const n of nodes) {
      const d = haversineMeters({ lat: c[0], lng: c[1] }, n);
      if (d < bestD) { bestD = d; best = n; }
    }
    return bestD <= MATCH_RADIUS_M ? best : null;
  };
  edges.forEach((e, i) => {
    const a = e.from_ref ? byRef.get(e.from_ref.toLowerCase()) : e.from_coord ? nearest(e.from_coord) : null;
    const b = e.to_ref ? byRef.get(e.to_ref.toLowerCase()) : e.to_coord ? nearest(e.to_coord) : null;
    if (!a || !b) {
      errors.push({ row: i + 1, message: `${!a ? `start "${e.from_ref ?? "coordinate"}"` : `end "${e.to_ref ?? "coordinate"}"`} does not match a place${e.from_ref || e.to_ref ? " ref" : " within 5 m"}` });
      return;
    }
    if (a.id === b.id) {
      errors.push({ row: i + 1, message: "start and end resolve to the same place" });
      return;
    }
    rows.push({
      from_node_id: a.id,
      to_node_id: b.id,
      name: e.name,
      distance_m: e.distance_m ?? Math.max(1, Math.round(haversineMeters(a, b))),
      surface: e.surface,
      clear_width_m: e.clear_width_m,
      slope_percent: e.slope_percent,
      has_steps: e.has_steps,
      step_count: e.step_count,
      has_kerb: e.has_kerb,
      has_ramp: e.has_ramp,
      classification: e.classification,
      barrier_status: e.barrier_status,
      notes: e.notes,
    });
  });
  return { rows, errors };
}

function csvCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function nodesToCsv(nodes: NodeRow[]) {
  return [NODE_COLUMNS.join(","), ...nodes.map((n) => NODE_COLUMNS.map((c) => csvCell((n as unknown as Record<string, unknown>)[c])).join(","))].join("\n");
}

export function edgesToCsv(edges: EdgeRow[], nodes: NodeRow[]) {
  const ref = new Map(nodes.map((n) => [n.id, n.ref ?? n.id]));
  const cols = [...EDGE_COLUMNS, "verification_status", "last_verified_at", "evidence_ref"];
  return [
    cols.join(","),
    ...edges.map((e) => {
      const rec: Record<string, unknown> = { ...e, from_ref: ref.get(e.from_node_id), to_ref: ref.get(e.to_node_id) };
      return cols.map((c) => csvCell(rec[c])).join(",");
    }),
  ].join("\n");
}

export function toGeoJson(nodes: NodeRow[], edges: EdgeRow[]) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return {
    type: "FeatureCollection",
    features: [
      ...nodes.map((n) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [n.lng, n.lat] },
        properties: { id: n.id, ref: n.ref, name: n.name, kind: n.kind, description: n.description, is_destination: n.is_destination, accessible_entrance: n.accessible_entrance, verification_status: n.verification_status, last_verified_at: n.last_verified_at, is_demo: n.is_demo },
      })),
      ...edges.flatMap((e) => {
        const a = nodeMap.get(e.from_node_id);
        const b = nodeMap.get(e.to_node_id);
        if (!a || !b) return [];
        const { from_node_id: _f, to_node_id: _t, ...rest } = e;
        return [{
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
          properties: { ...rest, from_ref: a.ref ?? a.id, to_ref: b.ref ?? b.id },
        }];
      }),
    ],
  };
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
