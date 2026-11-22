import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowUpDown, Clock, Crosshair, Footprints, Info, MapPin, Navigation, Ruler, ShieldAlert, TriangleRight, CheckCircle2, Phone,
} from "lucide-react";
import { campusDataQuery, selectableNodes, toGraph, useCampusRealtime } from "@/lib/campus-data";
import { NO_ROUTE_MESSAGE, findRoutes, haversineMeters } from "@/lib/routing/engine";
import { MODE_LABELS, defaultPrefs } from "@/lib/routing/rules";
import type { MobilityMode, RoutePrefs, RouteResult } from "@/lib/routing/types";
import { MapView } from "@/components/map/MapView";
import { DemoBanner } from "@/components/common/DemoBanner";
import { ErrorBlock, LoadingBlock } from "@/components/common/PageHeader";
import { DemoPill, Pill, VerificationBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SURFACE_LABELS, formatDate } from "@/lib/labels";
import { cn } from "@/lib/utils";

const MODES: MobilityMode[] = ["wheelchair", "avoid_stairs", "walking_aid", "temporary_injury", "general"];
const searchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  mode: z.enum(["wheelchair", "avoid_stairs", "walking_aid", "temporary_injury", "general"]).optional(),
});

export const Route = createFileRoute("/route")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Find the best accessible route – SugamPath LPU" },
      { name: "description", content: "Calculate step-free, wheelchair-friendly routes across LPU campus with distance, time, ramps, lifts and written directions." },
      { property: "og:title", content: "Find the best accessible route – SugamPath LPU" },
      { property: "og:description", content: "Step-free and wheelchair routes calculated from verified campus pathway data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoutePage,
});

const PREF_LABELS: { key: keyof RoutePrefs; label: string; help?: string }[] = [
  { key: "avoidStairs", label: "Avoid stairs and steps" },
  { key: "preferRamps", label: "Prefer ramps" },
  { key: "avoidSteepSlopes", label: "Avoid steep slopes", help: "Excludes slopes steeper than 1:12 (8.33%)" },
  { key: "avoidRoughSurfaces", label: "Avoid rough surfaces", help: "Gravel, grass, rough ground" },
  { key: "avoidNarrowPaths", label: "Avoid narrow pathways", help: "Narrower than 0.9 m is excluded" },
  { key: "minimiseDistance", label: "Minimise distance" },
  { key: "verifiedOnly", label: "Prefer verified routes only", help: "Only uses pathways with a current verification" },
];

interface Query { start: string; goal: string; mode: MobilityMode; prefs: RoutePrefs }

function RoutePage() {
  const search = Route.useSearch();
  const q = useQuery(campusDataQuery);
  useCampusRealtime();
  const [start, setStart] = useState(search.from ?? "");
  const [goal, setGoal] = useState(search.to ?? "");
  const [mode, setMode] = useState<MobilityMode>(search.mode ?? "wheelchair");
  const [prefs, setPrefs] = useState<RoutePrefs>(defaultPrefs(search.mode ?? "wheelchair"));
  const [query, setQuery] = useState<Query | null>(null);
  const [active, setActive] = useState<string>("best");
  const [formError, setFormError] = useState<string | null>(null);

  const data = q.data;
  const places = useMemo(() => (data ? selectableNodes(data.nodes) : []), [data]);

  const result = useMemo(() => {
    if (!data || !query) return null;
    const g = toGraph(data);
    return findRoutes({ ...g, startId: query.start, goalId: query.goal, mode: query.mode, prefs: query.prefs });
  }, [data, query]);

  function changeMode(m: MobilityMode) {
    setMode(m);
    setPrefs(defaultPrefs(m));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!start || !goal) { setFormError("Please choose both a starting location and a destination."); return; }
    if (start === goal) { setFormError("Start and destination must be different places."); return; }
    setFormError(null);
    setActive("best");
    setQuery({ start, goal, mode, prefs });
    requestAnimationFrame(() => document.getElementById("results")?.focus());
  }

  function nearestStart() {
    if (!data) return;
    if (!("geolocation" in navigator)) { toast.error("Your browser does not support location."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        let best: { id: string; d: number; name: string } | null = null;
        for (const n of places) {
          const d = haversineMeters(here, n);
          if (!best || d < best.d) best = { id: n.id, d, name: n.name };
        }
        if (!best || best.d > 1500) { toast.error("You don't seem to be near any recorded campus location."); return; }
        setStart(best.id);
        toast.success(`Start set to nearest place: ${best.name} (${Math.round(best.d)} m away). Your location was not stored.`);
      },
      () => toast.error("Location permission was not granted."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const routes = result?.routes ?? [];
  const activeRoute = routes.find((r) => r.key === active) ?? routes[0];
  const strictNoVerified = query && routes.length > 0 && query.mode === "wheelchair" && !routes.some((r) => r.verification === "verified");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold md:text-4xl">Find the best accessible route</h1>
      <p className="mt-1 text-lg text-muted-foreground">Routes are calculated on the recorded campus pathway network. Unknown accessibility is never treated as accessible.</p>
      {data?.hasDemo && <div className="mt-4"><DemoBanner /></div>}

      {q.isPending ? <div className="mt-6"><LoadingBlock label="Loading campus pathways…" /></div> : q.isError ? <div className="mt-6"><ErrorBlock message={`Could not load campus data: ${q.error.message}`} /></div> : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form onSubmit={submit} className="surface-card space-y-5 self-start p-5" noValidate aria-describedby={formError ? "route-error" : undefined}>
            <div className="space-y-1.5">
              <Label htmlFor="start" className="text-base font-bold">Starting location</Label>
              <select id="start" value={start} onChange={(e) => setStart(e.target.value)} className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base">
                <option value="">Choose a place…</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_demo ? " (demo)" : ""}</option>)}
              </select>
              <Button type="button" variant="link" size="sm" className="px-0" onClick={nearestStart}><Crosshair aria-hidden /> Use nearest place to my location</Button>
            </div>
            <div className="flex justify-center">
              <Button type="button" variant="outline" size="sm" onClick={() => { setStart(goal); setGoal(start); }} aria-label="Swap start and destination"><ArrowUpDown aria-hidden /> Swap</Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal" className="text-base font-bold">Destination</Label>
              <select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base">
                <option value="">Choose a place…</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_demo ? " (demo)" : ""}</option>)}
              </select>
            </div>

            <fieldset>
              <legend className="text-base font-bold">Mobility preference</legend>
              <div className="mt-2 space-y-2" role="radiogroup">
                {MODES.map((m) => (
                  <label key={m} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2", mode === m ? "border-primary bg-secondary" : "border-border")}>
                    <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => changeMode(m)} className="size-5 accent-primary" />
                    <span className="font-semibold">{MODE_LABELS[m]}</span>
                  </label>
                ))}
              </div>
              {mode === "wheelchair" && <p className="mt-2 text-sm text-muted-foreground">Strict mode: never uses steps, kerbs, blocked paths, unverified ramps, unmeasured pathways or lifts not confirmed operational.</p>}
            </fieldset>

            <fieldset>
              <legend className="text-base font-bold">Additional settings</legend>
              <div className="mt-2 space-y-2.5">
                {PREF_LABELS.map((p) => {
                  const locked = mode === "wheelchair" && p.key === "avoidStairs";
                  return (
                    <div key={p.key} className="flex items-start gap-3">
                      <Checkbox id={`p-${p.key}`} className="mt-0.5 size-6" checked={locked || prefs[p.key]} disabled={locked} onCheckedChange={(v) => setPrefs((s) => ({ ...s, [p.key]: v === true }))} aria-describedby={p.help ? `p-${p.key}-help` : undefined} />
                      <div>
                        <Label htmlFor={`p-${p.key}`} className="text-base font-normal">{p.label}{locked ? " (always on in strict mode)" : ""}</Label>
                        {p.help && <p id={`p-${p.key}-help`} className="text-sm text-muted-foreground">{p.help}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {formError && <p id="route-error" role="alert" className="font-semibold text-destructive">{formError}</p>}
            <Button type="submit" variant="hero" size="xl" className="w-full"><Navigation aria-hidden /> FIND BEST ROUTE</Button>
          </form>

          <section id="results" tabIndex={-1} aria-labelledby="results-title" className="space-y-5 focus:outline-none">
            <h2 id="results-title" className="sr-only">Route results</h2>
            {!query && (
              <div className="space-y-4">
                <div className="surface-card flex items-start gap-3 p-5">
                  <Info className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
                  <p>Choose where you're starting, where you're going and your mobility preference, then select <strong>Find best route</strong>. Up to three options are shown with written directions.</p>
                </div>
                {data && <MapView className="h-[460px]" ariaLabel="Campus pathway map" nodes={data.nodes} edges={data.edges} barriers={data.barriers} highlightNodeIds={[start, goal].filter(Boolean)} showJunctions={false} />}
              </div>
            )}

            {query && routes.length === 0 && (
              <div role="alert" className="surface-card border-2 border-destructive/50 p-6">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="size-8 shrink-0 text-destructive" aria-hidden />
                  <div>
                    <p className="text-xl font-bold">{NO_ROUTE_MESSAGE}</p>
                    {result && result.exclusionSummary.length > 0 && (
                      <>
                        <p className="mt-4 font-semibold">Pathways were excluded because:</p>
                        <ul className="mt-1 list-disc pl-6">{result.exclusionSummary.map((r) => <li key={r}>{r}</li>)}</ul>
                      </>
                    )}
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button asChild variant="outline"><Link to="/report"><AlertTriangle aria-hidden /> Report a barrier</Link></Button>
                      <Button asChild variant="outline"><Link to="/about"><Phone aria-hidden /> Campus support information</Link></Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {routes.length > 0 && activeRoute && (
              <>
                {strictNoVerified && (
                  <div role="alert" className="rounded-xl border-2 border-warning bg-warning/15 p-4 font-semibold">
                    No fully verified accessible route exists for these locations. The options below meet your constraints but include sections that are unverified or out of date — check them before travelling.
                  </div>
                )}
                <p role="status" className="text-muted-foreground">{routes.length} route option{routes.length > 1 ? "s" : ""} found for {MODE_LABELS[query!.mode]}.</p>
                <div className="grid gap-3 md:grid-cols-3" role="list">
                  {routes.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      role="listitem"
                      aria-pressed={r.key === activeRoute.key}
                      onClick={() => setActive(r.key)}
                      className={cn("surface-card p-4 text-left transition-colors", r.key === activeRoute.key ? "ring-4 ring-primary" : "hover:border-primary")}
                    >
                      <p className="text-sm font-bold uppercase tracking-wide text-primary">{r.label}</p>
                      <p className="mt-1 text-2xl font-bold">{r.timeMin} min · {r.distanceM} m</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <VerificationBadge status={r.verification} demo={r.isDemo} />
                        {r.tags.map((t) => <Pill key={t} tone="info">{t}</Pill>)}
                      </div>
                    </button>
                  ))}
                </div>

                <MapView
                  className="h-[440px]"
                  ariaLabel={`Map showing ${activeRoute.label}`}
                  nodes={data!.nodes.filter((n) => routes.some((r) => r.nodeIds.includes(n.id)))}
                  edges={data!.edges.filter((e) => e.barrier_status === "blocked")}
                  barriers={data!.barriers}
                  routes={routes}
                  activeRouteKey={activeRoute.key}
                />

                <RouteDetails route={activeRoute} />
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <dt className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground [&_svg]:size-4">{icon}{label}</dt>
      <dd className="mt-0.5 text-lg font-bold">{value}</dd>
    </div>
  );
}

function RouteDetails({ route }: { route: RouteResult }) {
  const surfaces = Object.entries(route.surfaces).sort((a, b) => b[1] - a[1]);
  return (
    <article className="surface-card p-5" aria-labelledby="route-detail-title">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="route-detail-title" className="text-2xl font-bold">{route.label}</h3>
        <VerificationBadge status={route.verification} demo={route.isDemo} />
        {route.isDemo && <DemoPill />}
      </div>
      {route.isDemo && <p className="mt-2 text-sm font-semibold text-demo-foreground">This route uses synthetic demonstration data – it is not verified LPU accessibility information.</p>}
      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Ruler aria-hidden />} label="Total distance" value={`${route.distanceM} m`} />
        <Stat icon={<Clock aria-hidden />} label="Estimated time" value={`${route.timeMin} min`} />
        <Stat icon={<MapPin aria-hidden />} label="Checkpoints" value={route.checkpoints} />
        <Stat icon={<Footprints aria-hidden />} label="Steps / kerbs" value={`${route.stepCount} steps · ${route.kerbs} kerbs`} />
        <Stat icon={<TriangleRight aria-hidden />} label="Ramps" value={route.ramps.length ? route.ramps.map((r) => `${r.verified ? "verified" : "UNVERIFIED"}${r.slope !== null ? ` ${r.slope}%` : ""}`).join(", ") : "None"} />
        <Stat icon={<ArrowUpDown aria-hidden />} label="Lift usage" value={route.lifts.length ? route.lifts.map((l) => l.label).join(", ") : "None"} />
        <Stat icon={<CheckCircle2 aria-hidden />} label="Last verified" value={route.oldestVerification ? formatDate(route.oldestVerification) : "Some sections never"} />
        <Stat icon={<Info aria-hidden />} label="Surface" value={surfaces.map(([s]) => SURFACE_LABELS[s as keyof typeof SURFACE_LABELS] ?? s).join(", ")} />
      </dl>
      {route.lifts.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Lift status: {route.lifts.map((l) => `${l.label} – ${l.status.replace(/_/g, " ")}, updated ${formatDate(l.updatedAt, true)}`).join("; ")}</p>
      )}

      <h4 className="mt-6 text-lg font-bold">Known accessibility concerns</h4>
      {route.concerns.length ? (
        <ul className="mt-1 space-y-1">
          {route.concerns.map((c) => <li key={c} className="flex items-start gap-2"><AlertTriangle className="mt-1 size-4 shrink-0 text-destructive" aria-hidden />{c}</li>)}
        </ul>
      ) : <p className="text-muted-foreground">None recorded for this route.</p>}

      <h4 className="mt-6 text-lg font-bold">Step-by-step directions</h4>
      <ol className="mt-2 space-y-2">
        {route.directions.map((d, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-border bg-background p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground" aria-hidden>{i + 1}</span>
            <span className="pt-0.5">{d}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}
