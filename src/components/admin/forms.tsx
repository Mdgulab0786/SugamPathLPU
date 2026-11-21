import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { EdgeRow, LiftRow, NodeRow } from "@/lib/db-types";
import { ACCESS_LABELS, BARRIER_LABELS, KIND_LABELS, SURFACE_LABELS } from "@/lib/labels";
import { CLASSES, BARRIERS, NODE_KINDS, SURFACES } from "@/lib/admin/import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { selectCls, useInvalidateMap } from "./useAdminData";

export function Field({ id, label, help, children }: { id: string; label: string; help?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

const tri = (v: boolean | null) => (v === null ? "" : v ? "yes" : "no");
const fromTri = (s: string) => (s === "" ? null : s === "yes");
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export function TriSelect({ id, value, onChange, yes = "Yes", no = "No" }: { id: string; value: boolean | null; onChange: (v: boolean | null) => void; yes?: string; no?: string }) {
  return (
    <select id={id} value={tri(value)} onChange={(e) => onChange(fromTri(e.target.value))} className={selectCls}>
      <option value="">Not recorded</option>
      <option value="yes">{yes}</option>
      <option value="no">{no}</option>
    </select>
  );
}

type NodeDraft = Pick<NodeRow, "name" | "kind" | "lat" | "lng" | "description" | "is_destination" | "accessible_entrance" | "ref">;

export function NodeForm({ initial, nodeId, onDone, onCancel }: { initial: NodeDraft; nodeId?: string; onDone: (id: string) => void; onCancel: () => void }) {
  const invalidate = useInvalidateMap();
  const [d, setD] = useState<NodeDraft>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof NodeDraft>(k: K, v: NodeDraft[K]) => setD((s) => ({ ...s, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) return void toast.error("Name is required.");
    if (!Number.isFinite(d.lat) || !Number.isFinite(d.lng)) return void toast.error("Coordinates are invalid.");
    setBusy(true);
    const payload = { ...d, name: d.name.trim(), ref: d.ref?.trim() || null, description: d.description?.trim() || null };
    const res = nodeId
      ? await supabase.from("route_nodes").update(payload).eq("id", nodeId).select("id").single()
      : await supabase.from("route_nodes").insert(payload).select("id").single();
    setBusy(false);
    if (res.error) return void toast.error(res.error.message);
    toast.success(nodeId ? "Place updated" : "Place added (unverified until surveyed)");
    invalidate();
    onDone(res.data.id);
  }
  const p = nodeId ?? "new";
  return (
    <form onSubmit={save} className="space-y-3">
      <Field id={`n-name-${p}`} label="Name"><Input id={`n-name-${p}`} value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={160} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`n-kind-${p}`} label="Type">
          <select id={`n-kind-${p}`} value={d.kind} onChange={(e) => set("kind", e.target.value as NodeDraft["kind"])} className={selectCls}>
            {NODE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field id={`n-ref-${p}`} label="Reference code (optional)"><Input id={`n-ref-${p}`} value={d.ref ?? ""} onChange={(e) => set("ref", e.target.value)} maxLength={60} /></Field>
        <Field id={`n-lat-${p}`} label="Latitude"><Input id={`n-lat-${p}`} type="number" step="any" value={d.lat} onChange={(e) => set("lat", Number(e.target.value))} /></Field>
        <Field id={`n-lng-${p}`} label="Longitude"><Input id={`n-lng-${p}`} type="number" step="any" value={d.lng} onChange={(e) => set("lng", Number(e.target.value))} /></Field>
        <Field id={`n-dest-${p}`} label="Selectable destination">
          <select id={`n-dest-${p}`} value={d.is_destination ? "yes" : "no"} onChange={(e) => set("is_destination", e.target.value === "yes")} className={selectCls}>
            <option value="no">No</option><option value="yes">Yes</option>
          </select>
        </Field>
        <Field id={`n-acc-${p}`} label="Accessible entrance"><TriSelect id={`n-acc-${p}`} value={d.accessible_entrance} onChange={(v) => set("accessible_entrance", v)} /></Field>
      </div>
      <Field id={`n-desc-${p}`} label="Accessibility notes"><Textarea id={`n-desc-${p}`} value={d.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={1000} /></Field>
      {nodeId && <p className="text-xs text-muted-foreground">Changing coordinates, type or entrance accessibility resets verification.</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{nodeId ? "Save place" : "Add place"}</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

type EdgeDraft = Pick<EdgeRow, "name" | "distance_m" | "surface" | "clear_width_m" | "slope_percent" | "has_steps" | "step_count" | "has_kerb" | "has_ramp" | "lift_id" | "barrier_status" | "barrier_note" | "classification" | "notes" | "from_node_id" | "to_node_id">;

export function EdgeForm({ initial, edgeId, lifts, onDone, onCancel }: { initial: EdgeDraft; edgeId?: string; lifts: LiftRow[]; onDone: (id: string) => void; onCancel: () => void }) {
  const invalidate = useInvalidateMap();
  const [d, setD] = useState<EdgeDraft>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EdgeDraft>(k: K, v: EdgeDraft[K]) => setD((s) => ({ ...s, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!(Number(d.distance_m) > 0)) return void toast.error("Distance must be greater than 0.");
    setBusy(true);
    const payload = { ...d, name: d.name?.trim() || null, notes: d.notes?.trim() || null, barrier_note: d.barrier_note?.trim() || null };
    const res = edgeId
      ? await supabase.from("route_edges").update(payload).eq("id", edgeId).select("id").single()
      : await supabase.from("route_edges").insert(payload).select("id").single();
    setBusy(false);
    if (res.error) return void toast.error(res.error.message);
    toast.success(edgeId ? "Pathway saved" : "Pathway added (unverified until surveyed)");
    invalidate();
    onDone(res.data.id);
  }
  const p = edgeId ?? "new";
  return (
    <form onSubmit={save} className="space-y-3">
      <Field id={`e-name-${p}`} label="Pathway name"><Input id={`e-name-${p}`} value={d.name ?? ""} onChange={(e) => set("name", e.target.value)} maxLength={160} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`e-dist-${p}`} label="Distance (m)"><Input id={`e-dist-${p}`} type="number" min={0.1} step="0.1" value={d.distance_m} onChange={(e) => set("distance_m", Number(e.target.value))} /></Field>
        <Field id={`e-surf-${p}`} label="Surface">
          <select id={`e-surf-${p}`} value={d.surface} onChange={(e) => set("surface", e.target.value as EdgeDraft["surface"])} className={selectCls}>
            {SURFACES.map((s) => <option key={s} value={s}>{SURFACE_LABELS[s]}</option>)}
          </select>
        </Field>
        <Field id={`e-width-${p}`} label="Clear width (m)" help="Blank = not measured"><Input id={`e-width-${p}`} type="number" step="0.05" min={0} value={d.clear_width_m ?? ""} onChange={(e) => set("clear_width_m", numOrNull(e.target.value))} /></Field>
        <Field id={`e-slope-${p}`} label="Slope (%)" help="Blank = not measured"><Input id={`e-slope-${p}`} type="number" step="0.1" min={0} max={100} value={d.slope_percent ?? ""} onChange={(e) => set("slope_percent", numOrNull(e.target.value))} /></Field>
        <Field id={`e-steps-${p}`} label="Steps or stairs"><TriSelect id={`e-steps-${p}`} value={d.has_steps} onChange={(v) => set("has_steps", v)} /></Field>
        <Field id={`e-sc-${p}`} label="Number of steps"><Input id={`e-sc-${p}`} type="number" min={0} value={d.step_count ?? ""} onChange={(e) => set("step_count", numOrNull(e.target.value))} /></Field>
        <Field id={`e-kerb-${p}`} label="Kerb without dropped kerb"><TriSelect id={`e-kerb-${p}`} value={d.has_kerb} onChange={(v) => set("has_kerb", v)} /></Field>
        <Field id={`e-ramp-${p}`} label="Ramp on this pathway">
          <select id={`e-ramp-${p}`} value={d.has_ramp ? "yes" : "no"} onChange={(e) => set("has_ramp", e.target.value === "yes")} className={selectCls}><option value="no">No</option><option value="yes">Yes</option></select>
        </Field>
        <Field id={`e-lift-${p}`} label="Depends on lift">
          <select id={`e-lift-${p}`} value={d.lift_id ?? ""} onChange={(e) => set("lift_id", e.target.value || null)} className={selectCls}>
            <option value="">No lift</option>
            {lifts.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </Field>
        <Field id={`e-cls-${p}`} label="Accessibility classification">
          <select id={`e-cls-${p}`} value={d.classification} onChange={(e) => set("classification", e.target.value as EdgeDraft["classification"])} className={selectCls}>
            {CLASSES.map((c) => <option key={c} value={c}>{ACCESS_LABELS[c]}</option>)}
          </select>
        </Field>
        <Field id={`e-bar-${p}`} label="Current barrier status">
          <select id={`e-bar-${p}`} value={d.barrier_status} onChange={(e) => set("barrier_status", e.target.value as EdgeDraft["barrier_status"])} className={selectCls}>
            {BARRIERS.map((b) => <option key={b} value={b}>{BARRIER_LABELS[b]}</option>)}
          </select>
        </Field>
        <Field id={`e-bn-${p}`} label="Barrier note"><Input id={`e-bn-${p}`} value={d.barrier_note ?? ""} onChange={(e) => set("barrier_note", e.target.value)} maxLength={200} /></Field>
      </div>
      <Field id={`e-notes-${p}`} label="Notes"><Textarea id={`e-notes-${p}`} value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} maxLength={1000} /></Field>
      {edgeId && <p className="text-xs text-muted-foreground">Changing measured attributes (distance, surface, width, slope, steps, kerb, ramp, lift, classification) resets verification. Barrier status does not.</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{edgeId ? "Save pathway" : "Add pathway"}</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

export function VerifyForm({ target, onDone }: { target: { type: "edge" | "node"; id: string; name: string }; onDone?: () => void }) {
  const { user } = useAuth();
  const invalidate = useInvalidateMap();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [by, setBy] = useState("");
  const [evidence, setEvidence] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (by.trim().length < 2) return void toast.error("Enter the person or staff role responsible.");
    if (evidence.trim().length < 2) return void toast.error("Enter an evidence reference (e.g. audit sheet or photo ID).");
    if (date > today) return void toast.error("Verification date cannot be in the future.");
    setBusy(true);
    const { error } = await supabase.from("route_verifications").insert({
      [target.type === "edge" ? "edge_id" : "node_id"]: target.id,
      verified_on: date,
      verified_by: by.trim(),
      evidence_ref: evidence.trim(),
      observations: obs.trim() || null,
      recorded_by: user.id,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`${target.name} marked verified`);
    setBy(""); setEvidence(""); setObs("");
    invalidate();
    onDone?.();
  }
  const p = `${target.type}-${target.id}`;
  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border-2 border-success/40 bg-success/5 p-4">
      <p className="font-bold">Record verification for {target.name}</p>
      <p className="text-sm text-muted-foreground">Only record a verification after an on-site inspection confirmed the recorded attributes.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`v-date-${p}`} label="Verification date"><Input id={`v-date-${p}`} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field id={`v-by-${p}`} label="Person or staff role responsible"><Input id={`v-by-${p}`} value={by} onChange={(e) => setBy(e.target.value)} maxLength={120} required /></Field>
      </div>
      <Field id={`v-ev-${p}`} label="Evidence reference" help="Audit sheet number, photo set ID or inspection record"><Input id={`v-ev-${p}`} value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={200} required /></Field>
      <Field id={`v-obs-${p}`} label="Accessibility observations"><Textarea id={`v-obs-${p}`} value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={2000} /></Field>
      <Button type="submit" variant="success" disabled={busy}>Save verification</Button>
    </form>
  );
}
