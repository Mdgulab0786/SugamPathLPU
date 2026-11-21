import { describe, expect, it } from "vitest";
import { parseEdgesCsv, parseGeoJson, parseNodesCsv, resolveEdges, triState } from "./import";

describe("route data import", () => {
  it("parses a valid nodes CSV and reports invalid rows with row numbers", () => {
    const csv = "ref,name,kind,lat,lng,is_destination,accessible_entrance\nA1,Block A,building,31.25,75.70,yes,unknown\nB1,,entrance,31.26,75.71,no,yes\nC1,Bad,spaceship,95,75,no,no";
    const res = parseNodesCsv(csv);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ ref: "A1", name: "Block A", kind: "building", is_destination: true, accessible_entrance: null });
    expect(res.errors.map((e) => e.row)).toEqual([3, 4]);
  });

  it("keeps unknown step data unknown instead of assuming no steps", () => {
    const res = parseEdgesCsv("from_ref,to_ref,has_steps,has_kerb\nA1,B1,,unknown");
    expect(res.rows[0]!.has_steps).toBeNull();
    expect(res.rows[0]!.has_kerb).toBeNull();
    expect(triState("maybe")).toBe("invalid");
  });

  it("imports GeoJSON points and lines and matches line ends to places within 5 m", () => {
    const geo = JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [75.7, 31.25] }, properties: { ref: "P1", name: "Gate", kind: "entrance" } },
        { type: "Feature", geometry: { type: "LineString", coordinates: [[75.7, 31.25], [75.701, 31.25]] }, properties: { name: "Path", has_steps: "no" } },
      ],
    });
    const { nodes, edges } = parseGeoJson(geo);
    expect(nodes.rows).toHaveLength(1);
    expect(edges.rows).toHaveLength(1);
    expect(edges.rows[0]!.distance_m).toBeGreaterThan(90);
    const resolved = resolveEdges(edges.rows, [
      { id: "n1", ref: "P1", lat: 31.25, lng: 75.7 },
      { id: "n2", ref: "P2", lat: 31.25001, lng: 75.701 },
    ]);
    expect(resolved.errors).toHaveLength(0);
    expect(resolved.rows[0]).toMatchObject({ from_node_id: "n1", to_node_id: "n2" });
  });

  it("rejects an edge whose ref does not match a place", () => {
    const parsed = parseEdgesCsv("from_ref,to_ref\nA1,ZZ");
    const res = resolveEdges(parsed.rows, [{ id: "a", ref: "A1", lat: 31, lng: 75 }]);
    expect(res.rows).toHaveLength(0);
    expect(res.errors[0]!.message).toMatch(/ZZ/);
  });
});
