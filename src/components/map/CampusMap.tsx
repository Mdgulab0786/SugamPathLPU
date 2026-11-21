import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents, CircleMarker } from "react-leaflet";
import type { EdgeRow, LiftRow, NodeRow, PublicBarrier } from "@/lib/db-types";
import type { RouteResult } from "@/lib/routing/types";
import { CATEGORY_LABELS, KIND_LABELS } from "@/lib/labels";

export const LPU_CENTER: [number, number] = [31.2547, 75.7036];

export interface CampusMapProps {
  nodes: NodeRow[];
  edges: EdgeRow[];
  lifts?: LiftRow[];
  barriers?: PublicBarrier[];
  routes?: RouteResult[];
  activeRouteKey?: string | null;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  highlightNodeIds?: string[];
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (id: string) => void;
  onBarrierClick?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  pendingPoint?: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
  className?: string;
  ariaLabel: string;
  showJunctions?: boolean;
}

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const KIND_GLYPH: Record<string, string> = {
  building: "B",
  destination: "D",
  entrance: "E",
  lift: "L",
  ramp: "R",
  checkpoint: "C",
  junction: "",
  other: "•",
};

function nodeIcon(n: NodeRow, selected: boolean) {
  const cls = ["building", "destination"].includes(n.kind) || n.is_destination ? "destination" : n.kind === "entrance" ? "entrance" : n.kind === "lift" ? "lift" : n.kind === "ramp" ? "ramp" : "junction";
  const size = cls === "junction" ? 18 : 30;
  return L.divIcon({
    className: "",
    html: `<div class="cr-marker cr-marker-${cls}${selected ? " cr-marker-selected" : ""}${n.verification_status === "verified" ? "" : " cr-marker-unverified"}" aria-hidden="true">${KIND_GLYPH[n.kind] ?? ""}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const barrierIcon = L.divIcon({ className: "", html: `<div class="cr-marker cr-marker-barrier" aria-hidden="true">!</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
const pendingIcon = L.divIcon({ className: "", html: `<div class="cr-marker cr-marker-user" aria-hidden="true">+</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0]!, Math.max(map.getZoom(), 17));
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 18 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return null;
}

export default function CampusMap(props: CampusMapProps) {
  const {
    nodes, edges, barriers = [], routes = [], activeRouteKey, selectedNodeId, selectedEdgeId, highlightNodeIds,
    onNodeClick, onEdgeClick, onBarrierClick, onMapClick, pendingPoint, userLocation, className, ariaLabel, showJunctions = true,
  } = props;
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const colors = useMemo(
    () => ({
      route: cssVar("--map-route", "#2457A7"),
      alt: cssVar("--map-alt", "#B45309"),
      blocked: cssVar("--map-blocked", "#DC3545"),
      unverified: cssVar("--map-unverified", "#4A5A73"),
      verified: cssVar("--map-verified", "#198754"),
      accent: cssVar("--accent", "#F59E0B"),
    }),
    [],
  );

  const activeRoute = routes.find((r) => r.key === activeRouteKey) ?? routes[0];
  const fitPoints: [number, number][] = activeRoute
    ? activeRoute.nodeIds.map((id) => nodeMap.get(id)).filter(Boolean).map((n) => [n!.lat, n!.lng])
    : nodes.map((n) => [n.lat, n.lng]);
  const fitKey = activeRoute ? `r-${activeRoute.key}-${activeRoute.nodeIds.join()}` : `g-${nodes.length}`;
  const highlight = new Set(highlightNodeIds ?? []);

  return (
    <div className={className} role="region" aria-label={ariaLabel}>
      <MapContainer center={LPU_CENTER} zoom={17} scrollWheelZoom className="h-full w-full rounded-xl" keyboard>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClickHandler onMapClick={onMapClick} />
        <FitBounds points={fitPoints} fitKey={fitKey} />

        {edges.map((e) => {
          const a = nodeMap.get(e.from_node_id);
          const b = nodeMap.get(e.to_node_id);
          if (!a || !b) return null;
          const blocked = e.barrier_status === "blocked";
          const verified = e.verification_status === "verified";
          const color = blocked ? colors.blocked : e.has_steps ? colors.unverified : verified ? colors.verified : colors.unverified;
          const selected = selectedEdgeId === e.id;
          return (
            <Polyline
              key={e.id}
              positions={[[a.lat, a.lng], [b.lat, b.lng]]}
              pathOptions={{
                color: selected ? colors.accent : color,
                weight: selected ? 9 : blocked ? 6 : 5,
                opacity: routes.length ? 0.35 : 0.85,
                dashArray: blocked ? "4 8" : verified && !e.has_steps ? undefined : "10 8",
              }}
              eventHandlers={onEdgeClick ? { click: (ev) => { L.DomEvent.stopPropagation(ev); onEdgeClick(e.id); } } : {}}
            >
              <Tooltip sticky>
                {e.name ?? "Pathway"} · {blocked ? "BLOCKED" : e.has_steps ? "Has steps" : verified ? "Verified" : "Not verified"}
                {e.is_demo ? " · Demo" : ""}
              </Tooltip>
            </Polyline>
          );
        })}

        {[...routes].sort((r) => (r.key === activeRoute?.key ? 1 : -1)).map((r) => {
          const active = r.key === activeRoute?.key;
          return r.segments.map((s) => (
            <Polyline
              key={`${r.key}-${s.edge.id}`}
              positions={[[s.from.lat, s.from.lng], [s.to.lat, s.to.lng]]}
              pathOptions={{
                color: active ? colors.route : colors.alt,
                weight: active ? 9 : 6,
                opacity: active ? 0.95 : 0.7,
                dashArray: s.evaluation.verifiedFresh && !s.evaluation.hasUnknowns ? (active ? undefined : "14 10") : "2 10",
                lineCap: "round",
              }}
            >
              <Tooltip sticky>{r.label}: {s.edge.name ?? "segment"}{s.evaluation.verifiedFresh ? "" : " (unverified section)"}</Tooltip>
            </Polyline>
          ));
        })}

        {nodes.map((n) => {
          if (!showJunctions && n.kind === "junction" && !highlight.has(n.id)) return null;
          return (
            <Marker
              key={n.id}
              position={[n.lat, n.lng]}
              icon={nodeIcon(n, selectedNodeId === n.id || highlight.has(n.id))}
              title={`${n.name} (${KIND_LABELS[n.kind]})`}
              alt={n.name}
              keyboard
              eventHandlers={onNodeClick ? { click: (ev) => { L.DomEvent.stopPropagation(ev as unknown as Event); onNodeClick(n.id); } } : {}}
            >
              <Tooltip direction="top" offset={[0, -14]}>
                {n.name}{n.is_demo ? " · Demo" : ""}
              </Tooltip>
            </Marker>
          );
        })}

        {barriers.map((b) => {
          const node = b.node_id ? nodeMap.get(b.node_id) : undefined;
          const lat = b.lat ?? node?.lat;
          const lng = b.lng ?? node?.lng;
          if (lat == null || lng == null) return null;
          return (
            <Marker
              key={`b-${b.id}`}
              position={[lat, lng]}
              icon={barrierIcon}
              title={`Reported barrier: ${CATEGORY_LABELS[b.category]}`}
              alt={`Reported barrier: ${CATEGORY_LABELS[b.category]}`}
              keyboard
              eventHandlers={onBarrierClick ? { click: () => onBarrierClick(b.id) } : {}}
            >
              <Tooltip direction="top" offset={[0, -14]}>Reported: {CATEGORY_LABELS[b.category]}</Tooltip>
            </Marker>
          );
        })}

        {pendingPoint && <Marker position={[pendingPoint.lat, pendingPoint.lng]} icon={pendingIcon} title="Selected point" alt="Selected point" />}
        {userLocation && (
          <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={10} pathOptions={{ color: colors.route, fillColor: colors.accent, fillOpacity: 0.9, weight: 3 }}>
            <Tooltip>Your location</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
