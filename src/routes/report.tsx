import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Copy, Crosshair, ImagePlus, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { campusDataQuery, selectableNodes } from "@/lib/campus-data";
import { submitBarrierReport } from "@/lib/reports.functions";
import { useAuth } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { ReportCategory } from "@/lib/db-types";
import { MapView } from "@/components/map/MapView";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report an accessibility barrier – SugamPath LPU" },
      { name: "description", content: "Tell LPU's estate team about a broken ramp, blocked pathway, locked entrance or lift problem. Get a report ID to track it." },
      { property: "og:title", content: "Report an accessibility barrier – SugamPath LPU" },
      { property: "og:description", content: "Report campus accessibility problems with an optional photo and track the repair." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function ReportPage() {
  const { user } = useAuth();
  const q = useQuery(campusDataQuery);
  const submit = useServerFn(submitBarrierReport);
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [nodeId, setNodeId] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locationText, setLocationText] = useState("");
  const [description, setDescription] = useState("");
  const [occurred, setOccurred] = useState(nowLocal());
  const [anonymous, setAnonymous] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; photoSaved: boolean; linked: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const places = q.data ? selectableNodes(q.data.nodes) : [];

  function pickFile(f: File | null) {
    if (!f) { setPhoto(null); setPreview(null); return; }
    if (!TYPES.includes(f.type)) { setErrors((e) => ({ ...e, photo: "Please choose a JPG, PNG or WebP image." })); return; }
    if (f.size > MAX) { setErrors((e) => ({ ...e, photo: "Photos must be 5 MB or smaller." })); return; }
    setErrors(({ photo: _p, ...rest }) => rest);
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  }

  function shareLocation() {
    if (!("geolocation" in navigator)) { toast.error("Your browser does not support location."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setPoint({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Location added to this report only."); },
      () => toast.error("Location permission was not granted."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!category) errs["category"] = "Please choose a barrier category.";
    if (description.trim().length < 10) errs["description"] = "Please describe the problem in at least 10 characters.";
    if (!nodeId && !point && locationText.trim().length < 3) errs["location"] = "Choose a place, pick a point on the map, or describe the location.";
    if (!occurred) errs["occurred"] = "Please enter when you noticed it.";
    else if (new Date(occurred).getTime() > Date.now() + 60_000) errs["occurred"] = "The date and time cannot be in the future.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(first === "location" ? "place" : first!)?.focus();
      return;
    }
    const fd = new FormData();
    fd.set("category", category);
    fd.set("description", description.trim());
    fd.set("location_text", locationText.trim());
    fd.set("node_id", nodeId);
    fd.set("lat", point ? String(point.lat) : "");
    fd.set("lng", point ? String(point.lng) : "");
    fd.set("occurred_at", new Date(occurred).toISOString());
    fd.set("anonymous", String(anonymous || !user));
    if (photo) fd.set("photo", photo);
    setBusy(true);
    try {
      const res = await submit({ data: fd });
      if (!res.ok) { toast.error(res.error); setErrors({ form: res.error }); return; }
      setDone({ code: res.code, photoSaved: res.photoSaved, linked: res.linkedToAccount });
      window.scrollTo({ top: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      toast.error(msg);
      setErrors({ form: msg });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="surface-card p-8 text-center" role="status">
          <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden />
          <h1 className="mt-4 text-3xl font-bold">Report submitted</h1>
          <p className="mt-2 text-lg text-muted-foreground">Thank you. The estate team has been notified in SugamPath LPU.</p>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your report ID</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-wider">{done.code}</p>
          <Button variant="outline" className="mt-3" onClick={() => { void navigator.clipboard.writeText(done.code); toast.success("Report ID copied"); }}><Copy aria-hidden /> Copy ID</Button>
          {photo && !done.photoSaved && <p className="mt-4 font-semibold text-destructive">Your report was saved but the photo could not be uploaded.</p>}
          <p className="mt-4 text-muted-foreground">{done.linked ? "This report is linked to your account — you'll get in-app updates when its status changes." : "Keep this ID to check progress — anonymous reports can only be tracked with it."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/track" search={{ code: done.code }}>Track this report</Link></Button>
            <Button size="lg" variant="outline" onClick={() => { setDone(null); setDescription(""); setCategory(""); setPhoto(null); setPreview(null); setPoint(null); setNodeId(""); setLocationText(""); }}>Report another</Button>
          </div>
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k] ? <p id={`${k}-error`} className="mt-1 font-semibold text-destructive">{errors[k]}</p> : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="Report Barrier" description="3-Tap Quick Report. Please don't include medical details or other personal information." />
      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="surface-card space-y-6 p-5">
            <h2 className="text-xl font-bold">3-Tap Quick Barrier Report</h2>
            <fieldset aria-describedby={errors["category"] ? "category-error" : undefined}>
              <legend className="text-base font-bold">1. Select Barrier Type <span aria-hidden>*</span></legend>
              <div id="category" tabIndex={-1} role="radiogroup" aria-label="Barrier type" className="mt-3 grid grid-cols-2 gap-2 focus:outline-none">
                {(Object.keys(CATEGORY_LABELS) as ReportCategory[]).map((k) => {
                  const on = category === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setCategory(k)}
                      className={cn(
                        "min-h-14 rounded-xl px-3 py-2 text-center text-sm font-bold transition-colors",
                        on ? "bg-navy text-navy-foreground shadow-md" : "bg-secondary text-foreground hover:bg-muted",
                      )}
                    >
                      {SHORT_LABELS[k]}
                    </button>
                  );
                })}
              </div>
              {err("category")}
            </fieldset>

            <fieldset className="space-y-3" aria-describedby={errors["location"] ? "location-error" : undefined}>
              <legend className="text-base font-bold">2. Location (Auto-GPS / Map) <span aria-hidden>*</span></legend>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="navy" size="sm" onClick={shareLocation}><Crosshair aria-hidden /> Use my GPS location</Button>
                {point && <Button type="button" variant="ghost" size="sm" onClick={() => setPoint(null)}><X aria-hidden /> Clear point</Button>}
              </div>
              {point && <p className="text-sm font-semibold text-success" role="status">Point selected ({point.lat.toFixed(5)}, {point.lng.toFixed(5)})</p>}
              <div>
                <Label htmlFor="place">Campus place</Label>
                <select id="place" value={nodeId} onChange={(e) => setNodeId(e.target.value)} className="mt-1.5 h-12 w-full rounded-lg border border-input bg-background px-3 text-base">
                  <option value="">Not listed / not sure</option>
                  {places.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_demo ? " (demo)" : ""}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="locationText">Describe the location</Label>
                <Input id="locationText" value={locationText} onChange={(e) => setLocationText(e.target.value)} maxLength={300} placeholder="e.g. East ramp junction near parking" className="mt-1.5 h-12 text-base" />
              </div>
              <p className="text-sm text-muted-foreground"><MapPin className="mr-1 inline size-4" aria-hidden />Or tap the exact point on the map:</p>
              {q.data && (
                <MapView className="h-64" ariaLabel="Map for choosing the barrier location. Click the map to place a marker." nodes={q.data.nodes} edges={[]} showJunctions={false} pendingPoint={point} selectedNodeId={nodeId || null} onMapClick={(lat, lng) => setPoint({ lat, lng })} onNodeClick={(id) => setNodeId(id)} />
              )}
              <p className="text-xs text-muted-foreground">Your location is only used when you choose to share it, and only for this report.</p>
              {err("location")}
            </fieldset>
          </div>
        </div>

        <div className="space-y-5">
          <div className="surface-card space-y-5 p-5">
            <div>
              <p className="text-base font-bold" id="photo-label">3. Add Photo (optional)</p>
              <input ref={fileRef} id="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-labelledby="photo-label" aria-describedby="photo-help" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
              {preview ? (
                <div className="mt-2 flex items-start gap-3">
                  <img src={preview} alt="Selected photo preview" className="h-28 w-40 rounded-lg border border-border object-cover" />
                  <Button type="button" variant="outline" size="sm" onClick={() => { pickFile(null); if (fileRef.current) fileRef.current.value = ""; }}><X aria-hidden /> Remove photo</Button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 flex min-h-24 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-secondary/50 font-semibold text-muted-foreground hover:border-primary hover:text-foreground">
                  <ImagePlus className="size-5" aria-hidden /> Attach Photo
                </button>
              )}
              <p id="photo-help" className="mt-1 text-sm text-muted-foreground">JPG, PNG or WebP, up to 5 MB. Avoid photographing people's faces.</p>
              {err("photo")}
            </div>
            <div>
              <Label htmlFor="description" className="text-base font-bold">What's the problem? <span aria-hidden>*</span></Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} aria-invalid={!!errors["description"]} aria-describedby={`desc-help${errors["description"] ? " description-error" : ""}`} className="mt-1.5 text-base" />
              <p id="desc-help" className="text-sm text-muted-foreground">How does it affect access? {description.length}/2000</p>
              {err("description")}
            </div>
            <div>
              <Label htmlFor="occurred" className="text-base font-bold">Noticed at <span aria-hidden>*</span></Label>
              <Input id="occurred" type="datetime-local" value={occurred} max={nowLocal()} onChange={(e) => setOccurred(e.target.value)} aria-invalid={!!errors["occurred"]} className="mt-1.5 h-12 text-base" />
              {err("occurred")}
            </div>
            <div className="border-t border-border pt-4">
              {user ? (
                <div className="flex items-start gap-3">
                  <Checkbox id="anon" checked={anonymous} onCheckedChange={(v) => setAnonymous(v === true)} className="mt-0.5 size-6" />
                  <div>
                    <Label htmlFor="anon" className="text-base font-normal">Submit anonymously</Label>
                    <p className="text-sm text-muted-foreground">Anonymous reports aren't linked to your account — track them with the report ID.</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">You're submitting anonymously. <Link to="/auth" search={{ redirect: "/report" }} className="font-semibold text-primary underline underline-offset-4">Sign in</Link> to get status updates.</p>
              )}
            </div>
          </div>
          {errors["form"] && <p role="alert" className="font-semibold text-destructive">{errors["form"]}</p>}
          <Button type="submit" size="xl" variant="hero" className="w-full" disabled={busy}>{busy ? "Submitting…" : "Submit & Reroute Users"}</Button>
          <p className="text-center text-sm text-muted-foreground">Estate staff are alerted instantly. Once a barrier is confirmed, routes avoid it automatically.</p>
        </div>
      </form>
    </div>
  );
}

const SHORT_LABELS: Record<ReportCategory, string> = {
  broken_ramp: "Blocked / Broken Ramp",
  lift_not_working: "Locked Lift",
  ramp_ends_at_step: "Kerb / Step",
  blocked_pathway: "Obstacle on Path",
  locked_entrance: "Locked Entrance",
  damaged_pavement: "Damaged Pavement",
  narrow_pathway: "Narrow Path",
  missing_signage: "Missing Signage",
  other: "Other Issue",
};
