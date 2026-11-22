import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Crosshair, Navigation, Search, X, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { campusDataQuery, type CampusData } from "@/lib/campus-data";
import { MapView } from "@/components/map/MapView";
import { MapLegend } from "@/components/map/MapLegend";
import { DemoBanner } from "@/components/common/DemoBanner";
import { PageHeader, EmptyState, ErrorBlock, LoadingBlock } from "@/components/common/PageHeader";
import { DemoPill, LiftStatusBadge, Pill, VerificationBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { isStale, liftConfirmedOperational } from "@/lib/routing/rules";
import { ACCESS_LABELS, CATEGORY_LABELS, KIND_LABELS, STATUS_LABELS, SURFACE_LABELS, formatDate, timeAgo } from "@/lib/labels";
import type { EdgeRow, NodeRow } from "@/lib/db-types";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Accessible campus map – SugamPath LPU" },
      { name: "description", content: "Interactive LPU campus accessibility map: entrances, ramps, lifts, verified pathways and reported barriers." },
      { property: "og:title", content: "Accessible campus map – SugamPath LPU" },
      { property: "og:description", content: "See verified pathways, ramps, lifts and reported barriers on the campus map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

type FilterKey = "wheelchair" | "stairFree" | "ramp" | "lift" | "barriers" | "verified";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "wheelchair", label: "Wheelchair accessible" },
  { key: "stairFree", label: "Stair-free" },
  { key: "ramp", label: "Ramp available" },
  { key: "lift", label: "Lift available" },
  { key: "barriers", label: "Temporary barriers" },
  { key: "verified", label: "Verified routes only" },
];

type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | { type: "barrier"; id: string } | null;

function MapPage() {
  const q = useQuery(campusDataQuery);
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    wheelchair: false, stairFree: false, ramp: false, lift: false, barriers: true, verified: false,
  });
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Selection>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  const data = q.data;
  const now = Date.now();

  const view = useMemo(() => {
    if (!data) return null;
    const liftMap = new Map(data.lifts.map((l) => [l.id, l]));
    const ctx = { now: new Date(now), freshnessDays: data.settings.verification_freshness_days, liftFreshnessHours: data.settings.lift_status_freshness_hours };
    const edgeOk = (e: EdgeRow) => {
      if (filters.wheelchair && !(e.classification === "accessible" && e.has_steps === false && e.has_kerb === false && e.barrier_status !== "blocked" && (!e.has_ramp || e.ramp_verified))) return false;
      if (filters.stairFree && e.has_steps !== false) return false;
      if (filters.ramp && !e.has_ramp) return false;
      if (filters.lift && !(e.lift_id && liftConfirmedOperational(liftMap.get(e.lift_id), ctx) !== "down")) return false;
      if (filters.verified && !(e.verification_status === "verified" && !isStale(e.last_verified_at, ctx))) return false;
      return true;
    };
    const edges = data.edges.filter(edgeOk);
    const anyEdgeFilter = filters.wheelchair || filters.stairFree || filters.ramp || filters.lift || filters.verified;
    const touched = new Set(edges.flatMap((e) => [e.from_node_id, e.to_node_id]));
    const nodes = data.nodes.filter((n) => {
      if (filters.verified && n.verification_status !== "verified") return false;
      if (filters.ramp && !touched.has(n.id) && n.kind !== "ramp") return false;
      if (filters.lift && !touched.has(n.id) && n.kind !== "lift") return false;
      if (!anyEdgeFilter) return true;
      return touched.has(n.id) || n.is_destination;
    });
    return { edges, nodes, barriers: filters.barriers ? data.barriers : [] };
  }, [data, filters, now]);

  const results = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!data || s.length < 1) return [];
    return data.nodes.filter((n) => n.name.toLowerCase().includes(s) || (n.ref ?? "").toLowerCase().includes(s)).slice(0, 8);
  }, [data, search]);

  function locate() {
    if (!("geolocation" in navigator)) { toast.error("Your browser does not support location."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Showing your location once. It is not stored or tracked."); },
      () => toast.error("Location permission was not granted."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Accessible Map"
        description="Step-free paths & live barriers. Select a marker or pathway to see when it was last checked."
        actions={<>
          <Button variant="onDark" onClick={locate}><Crosshair aria-hidden /> My location</Button>
          <Button asChild variant="hero"><Link to="/route"><Navigation aria-hidden /> Find a route</Link></Button>
        </>}
      />

      {data?.hasDemo && <div className="mt-4"><DemoBanner /></div>}

      {q.isPending ? <div className="mt-6"><LoadingBlock label="Loading campus map data…" /></div> : q.isError ? <div className="mt-6"><ErrorBlock message={`Could not load map data: ${q.error.message}`} /></div> : data && view && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <div className="surface-card p-4">
              <Label htmlFor="map-search" className="text-base font-bold">Search campus locations</Label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="map-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-12 pl-10 text-base" placeholder="e.g. Library" autoComplete="off" />
              </div>
              {results.length > 0 && (
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border" aria-label="Search results">
                  {results.map((n) => (
                    <li key={n.id}>
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted" onClick={() => { setSel({ type: "node", id: n.id }); setSearch(""); }}>
                        <MapPin className="size-4 text-primary" aria-hidden /> <span className="flex-1">{n.name}</span>
                        <span className="text-sm text-muted-foreground">{KIND_LABELS[n.kind]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {search && results.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No matching locations.</p>}
            </div>

            <fieldset className="surface-card p-4">
              <legend className="sr-only">Map filters</legend>
              <p className="text-base font-bold" aria-hidden>Filters</p>
              <div className="mt-2 space-y-2.5">
                {FILTERS.map((f) => (
                  <div key={f.key} className="flex items-center gap-3">
                    <Checkbox id={`f-${f.key}`} checked={filters[f.key]} onCheckedChange={(v) => setFilters((s) => ({ ...s, [f.key]: v === true }))} className="size-6" />
                    <Label htmlFor={`f-${f.key}`} className="text-base font-normal">{f.label}</Label>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground" role="status">{view.nodes.length} places · {view.edges.length} pathways shown</p>
            </fieldset>

            <MapLegend />
          </aside>

          <div className="space-y-4">
            {data.nodes.length === 0 ? (
              <EmptyState icon={<MapPin aria-hidden />} title="No campus locations recorded yet">
                Authorised staff can add verified locations and pathways from Map administration.
              </EmptyState>
            ) : (
              <MapView
                className="h-[520px] lg:h-[640px]"
                ariaLabel="Interactive campus accessibility map"
                nodes={view.nodes}
                edges={view.edges}
                lifts={data.lifts}
                barriers={view.barriers}
                selectedNodeId={sel?.type === "node" ? sel.id : null}
                selectedEdgeId={sel?.type === "edge" ? sel.id : null}
                onNodeClick={(id) => setSel({ type: "node", id })}
                onEdgeClick={(id) => setSel({ type: "edge", id })}
                onBarrierClick={(id) => setSel({ type: "barrier", id })}
                userLocation={userLoc}
              />
            )}
            {sel && <DetailPanel sel={sel} data={data} onClose={() => setSel(null)} onSelect={setSel} />}
          </div>
        </div>
      )}
    </div>
  );
}

function YesNo({ v, yes, no }: { v: boolean | null; yes: string; no: string }) {
  if (v === null) return <Pill tone="neutral">Not recorded</Pill>;
  return v ? <Pill tone="success">{yes}</Pill> : <Pill tone="warning">{no}</Pill>;
}

function DetailPanel({ sel, data, onClose, onSelect }: { sel: NonNullable<Selection>; data: CampusData; onClose: () => void; onSelect: (s: Selection) => void }) {
  const ctx = { now: new Date(), freshnessDays: data.settings.verification_freshness_days, liftFreshnessHours: data.settings.lift_status_freshness_hours };
  const nodeName = (id: string) => data.nodes.find((n) => n.id === id)?.name ?? "Unknown place";
  let body: React.ReactNode = null;
  let title = "";

  if (sel.type === "node") {
    const n = data.nodes.find((x) => x.id === sel.id) as NodeRow | undefined;
    if (!n) return null;
    title = n.name;
    const connected = data.edges.filter((e) => e.from_node_id === n.id || e.to_node_id === n.id);
    const lift = data.lifts.find((l) => l.node_id === n.id);
    const barriers = data.barriers.filter((b) => b.node_id === n.id);
    const goodAlt = connected.filter((e) => e.barrier_status !== "blocked" && e.has_steps === false && e.verification_status === "verified");
    body = (
      <>
        <div className="flex flex-wrap gap-2">
          <Pill tone="info">{KIND_LABELS[n.kind]}</Pill>
          <VerificationBadge status={n.verification_status} stale={n.verification_status === "verified" && isStale(n.last_verified_at, ctx)} demo={n.is_demo} />
          {n.is_demo && <DemoPill />}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><dt className="text-sm font-semibold text-muted-foreground">Last checked</dt><dd>{formatDate(n.last_verified_at)}</dd></div>
          <div><dt className="text-sm font-semibold text-muted-foreground">Accessible entrance</dt><dd><YesNo v={n.accessible_entrance} yes="Yes" no="No" /></dd></div>
          {n.description && <div className="sm:col-span-2"><dt className="text-sm font-semibold text-muted-foreground">Accessibility information</dt><dd>{n.description}</dd></div>}
          {lift && (
            <div className="sm:col-span-2"><dt className="text-sm font-semibold text-muted-foreground">{lift.label}</dt>
              <dd className="flex flex-wrap items-center gap-2"><LiftStatusBadge status={lift.status} stale={liftConfirmedOperational(lift, ctx) === "stale"} /> <span className="text-sm text-muted-foreground">updated {timeAgo(lift.status_updated_at)}</span></dd></div>
          )}
        </dl>
        <h3 className="mt-5 font-bold">Known barriers</h3>
        {barriers.length || connected.some((e) => e.barrier_status !== "clear") ? (
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {barriers.map((b) => <li key={b.id}>Reported: {CATEGORY_LABELS[b.category]} ({STATUS_LABELS[b.status]}, {formatDate(b.created_at)})</li>)}
            {connected.filter((e) => e.barrier_status !== "clear").map((e) => <li key={e.id}>{e.name ?? "Pathway"}: {e.barrier_status}{e.barrier_note ? ` – ${e.barrier_note}` : ""}</li>)}
          </ul>
        ) : <p className="text-muted-foreground">No open barriers recorded here.</p>}
        <h3 className="mt-5 font-bold">Connected pathways</h3>
        <ul className="mt-1 space-y-1">
          {connected.map((e) => (
            <li key={e.id}>
              <button type="button" className="text-left text-primary underline underline-offset-4 hover:no-underline" onClick={() => onSelect({ type: "edge", id: e.id })}>
                {e.name ?? "Pathway"} → {nodeName(e.from_node_id === n.id ? e.to_node_id : e.from_node_id)}
              </button>
              <span className="text-sm text-muted-foreground"> · {e.barrier_status === "blocked" ? "blocked" : e.has_steps ? "has steps" : e.verification_status === "verified" ? "verified" : "not verified"}</span>
            </li>
          ))}
          {connected.length === 0 && <li className="text-muted-foreground">No pathways recorded.</li>}
        </ul>
        <h3 className="mt-5 font-bold">Available alternative</h3>
        <p className="text-muted-foreground">
          {lift?.alternative_info ?? (goodAlt.length ? `${goodAlt.length} verified step-free pathway${goodAlt.length > 1 ? "s" : ""} connect here. Use Find route for full options.` : "No verified step-free alternative recorded.")}
        </p>
      </>
    );
  } else if (sel.type === "edge") {
    const e = data.edges.find((x) => x.id === sel.id);
    if (!e) return null;
    title = e.name ?? "Pathway";
    const lift = e.lift_id ? data.lifts.find((l) => l.id === e.lift_id) : undefined;
    const stale = e.verification_status === "verified" && isStale(e.last_verified_at, ctx);
    body = (
      <>
        <p className="text-muted-foreground">{nodeName(e.from_node_id)} ↔ {nodeName(e.to_node_id)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <VerificationBadge status={e.verification_status} stale={stale} demo={e.is_demo} />
          {e.barrier_status === "blocked" && <Pill tone="danger" icon={<AlertTriangle aria-hidden />}>Blocked</Pill>}
          {e.barrier_status === "caution" && <Pill tone="warning" icon={<AlertTriangle aria-hidden />}>Caution</Pill>}
          <Pill tone={e.classification === "accessible" ? "success" : e.classification === "inaccessible" ? "danger" : "neutral"}>{ACCESS_LABELS[e.classification]}</Pill>
          {e.is_demo && <DemoPill />}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div><dt className="text-sm font-semibold text-muted-foreground">Distance</dt><dd>{Math.round(Number(e.distance_m))} m</dd></div>
          <div><dt className="text-sm font-semibold text-muted-foreground">Surface</dt><dd>{SURFACE_LABELS[e.surface]}</dd></div>
          <div><dt className="text-sm font-semibold text-muted-foreground">Clear width</dt><dd>{e.clear_width_m !== null ? `${e.clear_width_m} m` : "Not measured"}</dd></div>
          <div><dt className="text-sm font-semibold text-muted-foreground">Slope</dt><dd>{e.slope_percent !== null ? `${e.slope_percent}%` : "Not measured"}</dd></div>
          <div><dt className="text-sm font-semibold text-muted-foreground">Steps</dt><dd><YesNo v={e.has_steps === null ? null : !e.has_steps} yes="No steps" no={`${e.step_count ?? ""} steps`.trim()} /></dd></div>
          <div><dt className="text-sm font-semibold text-muted-foreground">Kerb</dt><dd><YesNo v={e.has_kerb === null ? null : !e.has_kerb} yes="No kerb" no="Kerb" /></dd></div>
          <div><dt className="text-sm font-semibold text-muted-foreground">Ramp</dt><dd>{e.has_ramp ? (e.ramp_verified ? <Pill tone="success">Verified ramp</Pill> : <Pill tone="warning">Unverified ramp</Pill>) : "None"}</dd></div>
          {lift && <div><dt className="text-sm font-semibold text-muted-foreground">Uses lift</dt><dd>{lift.label} · <LiftStatusBadge status={lift.status} stale={liftConfirmedOperational(lift, ctx) === "stale"} /></dd></div>}
          <div><dt className="text-sm font-semibold text-muted-foreground">Last checked</dt><dd>{formatDate(e.last_verified_at)}</dd></div>
        </dl>
        {e.barrier_note && <p className="mt-3"><strong>Barrier note:</strong> {e.barrier_note}</p>}
      </>
    );
  } else {
    const b = data.barriers.find((x) => x.id === sel.id);
    if (!b) return null;
    title = `Reported barrier: ${CATEGORY_LABELS[b.category]}`;
    body = (
      <dl className="grid gap-3 sm:grid-cols-3">
        <div><dt className="text-sm font-semibold text-muted-foreground">Status</dt><dd>{STATUS_LABELS[b.status]}</dd></div>
        <div><dt className="text-sm font-semibold text-muted-foreground">Reported</dt><dd>{formatDate(b.created_at)}</dd></div>
        <div><dt className="text-sm font-semibold text-muted-foreground">Location</dt><dd>{b.node_id ? nodeName(b.node_id) : b.location_text ?? "Map point"}</dd></div>
        <p className="text-sm text-muted-foreground sm:col-span-3">Personal details and descriptions of reports are never shown publicly.</p>
      </dl>
    );
  }

  return (
    <section className="surface-card p-5" aria-labelledby="detail-title" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h2 id="detail-title" className="text-2xl font-bold">{title}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details"><X aria-hidden /></Button>
      </div>
      <div className="mt-2">{body}</div>
    </section>
  );
}
