import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, LockKeyhole, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { ReportRow, ReportStatus, ReportPriority } from "@/lib/db-types";
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_FLOW, PRIORITY_LABELS, formatDate } from "@/lib/labels";
import { RoleGate } from "@/components/common/RoleGate";
import { PageHeader, LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/PageHeader";
import { ReportStatusBadge, PriorityBadge } from "@/components/common/badges";
import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/staff/reports/$id")({
  head: () => ({ meta: [
    { title: "Manage accessibility report – ClearRoute" },
    { name: "description", content: "Review an accessibility report, coordinate repairs and record resolution evidence." },
    { property: "og:title", content: "Manage accessibility report – ClearRoute" },
    { property: "og:description", content: "Private estate report workspace with assignments, internal notes and audit history." },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => <RoleGate need="staff"><Detail /></RoleGate>,
});
const selectClass = "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";
const message = (error: unknown) => error instanceof Error ? error.message : error && typeof error === "object" && "message" in error ? String(error.message) : "The request failed. Please try again.";

function Detail() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["staff", "report", id], queryFn: async () => {
    const result = await supabase.from("barrier_reports").select("*").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  } });
  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-10">
    <Link to="/staff" className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft aria-hidden className="size-5" />Back to estate dashboard</Link>
    {query.isPending ? <LoadingBlock label="Loading report…" /> : query.isError ? <><ErrorBlock message={query.error.message} /><Button onClick={() => void query.refetch()}>Retry report</Button></> : !query.data ? <EmptyState title="Report not found">This report may no longer be available.</EmptyState> : <Workspace key={id} report={query.data} />}
  </div>;
}

function Workspace({ report }: { report: ReportRow }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const related = useQuery({ queryKey: ["staff", "report-related", report.id], queryFn: async () => {
    const [staff, attachments, notes, history, audit] = await Promise.all([
      supabase.rpc("list_staff"),
      supabase.from("report_attachments").select("*").eq("report_id", report.id).order("created_at"),
      supabase.from("report_notes").select("*").eq("report_id", report.id).order("created_at", { ascending: false }),
      supabase.from("report_status_history").select("*").eq("report_id", report.id).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").eq("entity_type", "barrier_reports").eq("entity_id", report.id).order("created_at", { ascending: false }),
    ]);
    for (const result of [staff, attachments, notes, history, audit]) if (result.error) throw result.error;
    const node = report.node_id ? await supabase.from("route_nodes").select("*").eq("id", report.node_id).maybeSingle() : null;
    if (node?.error) throw node.error;
    return { staff: staff.data ?? [], attachments: attachments.data ?? [], notes: notes.data ?? [], history: history.data ?? [], audit: audit.data ?? [], node: node?.data ?? null };
  } });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["staff"] }); };
  const addNote = useMutation({ mutationFn: async () => {
    if (!user) throw new Error("Sign in again before adding a note.");
    const body = note.trim();
    if (!body || body.length > 2000) throw new Error("Enter a note between 1 and 2000 characters.");
    const result = await supabase.from("report_notes").insert({ report_id: report.id, author_id: user.id, body });
    if (result.error) throw result.error;
  }, onSuccess: () => { setNote(""); toast.success("Internal note added"); refresh(); }, onError: error => toast.error(message(error)) });
  const upload = useMutation({ mutationFn: async () => {
    if (!user) throw new Error("Sign in again before uploading evidence.");
    if (!file) throw new Error("Choose an image to upload.");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : null;
    if (!extension) throw new Error("Choose a JPEG, PNG or WebP image.");
    if (file.size > 5 * 1024 * 1024 || file.size === 0) throw new Error("Choose a non-empty image no larger than 5 MB.");
    const path = `${report.id}/resolution/${crypto.randomUUID()}.${extension}`;
    const stored = await supabase.storage.from("report-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (stored.error) throw stored.error;
    const saved = await supabase.from("report_attachments").insert({ report_id: report.id, storage_path: path, kind: "resolution", uploaded_by: user.id });
    if (saved.error) {
      // Best effort only: some deployments do not grant storage DELETE.
      await supabase.storage.from("report-photos").remove([path]).catch(() => null);
      throw saved.error;
    }
  }, onSuccess: () => { setFile(null); setFileKey(k => k + 1); toast.success("Resolution evidence uploaded"); refresh(); }, onError: error => toast.error(message(error)) });
  const data = related.data;
  const names = new Map((data?.staff ?? []).map(s => [s.id, s.display_name || "Staff member"]));
  return <>
    <PageHeader eyebrow="Accessibility report" title={report.code} description={<div className="space-y-3"><p>{CATEGORY_LABELS[report.category]}</p><div className="flex flex-wrap items-center gap-3"><ReportStatusBadge status={report.status} /><PriorityBadge priority={report.priority} /><span className="inline-flex items-center gap-2 text-base"><UserRound aria-hidden className="size-4" />{report.is_anonymous ? "Anonymous reporter" : "Registered reporter"}</span></div><p className="text-base">Submitted {formatDate(report.created_at, true)}</p></div>} />
    {related.isPending ? <LoadingBlock label="Loading location, evidence and report history…" /> : related.isError ? <><ErrorBlock message={related.error.message} /><Button onClick={() => void related.refetch()}>Retry report details</Button></> : data ? <>
      <div className="grid items-start gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2">
        <section className="surface-card space-y-4 p-6"><h2 className="text-xl font-bold">Description</h2><p className="whitespace-pre-wrap break-words leading-relaxed">{report.description || "No description provided."}</p><h2 className="pt-3 text-xl font-bold">Location</h2><p>{report.location_text || "No location text provided."}</p>{data.node && <p><strong>Linked place:</strong> {data.node.name}</p>}{data.node || (report.lat !== null && report.lng !== null) ? <MapView nodes={data.node ? [data.node] : []} edges={[]} pendingPoint={report.lat !== null && report.lng !== null ? { lat: report.lat, lng: report.lng } : null} className="h-72" ariaLabel={`Location of report ${report.code}`} /> : <p className="text-muted-foreground">No map coordinates recorded.</p>}</section>
        <section className="surface-card space-y-6 p-6"><h2 className="text-xl font-bold">Photos and evidence</h2>{(["photo", "resolution"] as const).map(kind => <div key={kind} className="space-y-3"><h3 className="font-semibold">{kind === "photo" ? "Submitted photos" : "Resolution evidence"}</h3>{data.attachments.some(a => a.kind === kind) ? <div className="grid gap-4 sm:grid-cols-2">{data.attachments.filter(a => a.kind === kind).map(a => <SignedPhoto key={a.id} path={a.storage_path} alt={kind === "photo" ? `Photo submitted with report ${report.code}` : `Resolution evidence for report ${report.code}`} />)}</div> : <p className="text-muted-foreground">No {kind === "photo" ? "submitted photos" : "resolution evidence"} yet.</p>}</div>)}</section>
        <section className="surface-card space-y-4 p-6" aria-labelledby="notes-title"><h2 id="notes-title" className="flex items-center gap-2 text-xl font-bold"><LockKeyhole aria-hidden className="size-5" />Internal notes</h2><p className="text-muted-foreground">Visible only to staff; never shown to the reporter.</p><form className="space-y-3" onSubmit={e => { e.preventDefault(); addNote.mutate(); }}><Label htmlFor="internal-note">New internal note</Label><Textarea id="internal-note" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} required rows={4} aria-describedby="note-limit" disabled={addNote.isPending} /><p id="note-limit" className="text-sm text-muted-foreground">{note.length}/2000 characters</p><Button disabled={!note.trim() || addNote.isPending}>{addNote.isPending ? "Adding note…" : "Add note"}</Button></form>{data.notes.length ? <ul className="divide-y divide-border">{data.notes.map(n => <li key={n.id} className="space-y-2 py-4"><p className="whitespace-pre-wrap break-words">{n.body}</p><p className="text-sm text-muted-foreground">{names.get(n.author_id) ?? "Staff member"} · {formatDate(n.created_at, true)}</p></li>)}</ul> : <p className="text-muted-foreground">No internal notes yet.</p>}</section>
      </div><aside className="space-y-6"><Management key={`${report.status}:${report.priority}:${report.assigned_to}`} report={report} staff={data.staff} />
        <section className="surface-card space-y-4 p-6"><h2 className="text-xl font-bold">Upload resolution evidence</h2><form className="space-y-4" onSubmit={e => { e.preventDefault(); upload.mutate(); }}><Label htmlFor="resolution-file">Resolution image</Label><Input key={fileKey} id="resolution-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.isPending} aria-describedby="evidence-help" onChange={e => {
          const chosen = e.target.files?.[0] ?? null;
          if (chosen && (!["image/jpeg", "image/png", "image/webp"].includes(chosen.type) || chosen.size > 5 * 1024 * 1024 || !chosen.size)) { toast.error("Choose a non-empty JPEG, PNG or WebP image no larger than 5 MB."); e.target.value = ""; setFile(null); return; }
          setFile(chosen);
        }} /><p id="evidence-help" className="text-sm text-muted-foreground">JPEG, PNG or WebP · Maximum 5 MB. Uploading evidence does not change report status.</p><Button disabled={!file || upload.isPending}>{upload.isPending ? "Uploading evidence…" : "Upload evidence"}</Button></form></section>
      </aside></div>
      <div className="grid items-start gap-6 lg:grid-cols-2"><section className="surface-card space-y-4 p-6"><h2 className="text-xl font-bold">Status timeline</h2>{data.history.length ? <ol className="space-y-5">{data.history.map(h => <li key={h.id} className="flex gap-3"><Clock aria-hidden className="mt-1 size-5 shrink-0 text-primary" /><div><p className="font-medium">{h.old_status ? STATUS_LABELS[h.old_status] : "Created"} → {STATUS_LABELS[h.new_status]}</p><p className="text-sm text-muted-foreground">{formatDate(h.created_at, true)} · {h.changed_by ? names.get(h.changed_by) ?? "Staff member" : "System"}</p></div></li>)}</ol> : <p className="text-muted-foreground">No status changes recorded.</p>}</section>
      <section className="surface-card space-y-4 p-6"><h2 className="text-xl font-bold">Audit log</h2>{data.audit.length ? <ul className="divide-y divide-border">{data.audit.map(a => <li key={a.id} className="space-y-2 py-4"><p className="font-semibold">{a.action}</p><AuditDetails details={a.details} /><p className="text-sm text-muted-foreground">{formatDate(a.created_at, true)} · {a.actor_id ? names.get(a.actor_id) ?? "Staff member" : "System"}</p></li>)}</ul> : <p className="text-muted-foreground">No audit events recorded.</p>}</section></div>
    </> : null}
  </>;
}

function Management({ report, staff }: { report: ReportRow; staff: { id: string; display_name: string }[] }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [priority, setPriority] = useState<ReportPriority | "">(report.priority ?? "");
  const [assignee, setAssignee] = useState(report.assigned_to ?? "");
  const save = useMutation({ mutationFn: async (quickResolve: boolean) => {
    // Exactly one report update; all history, notifications and audit events are trigger-owned.
    const updates = quickResolve ? { status: "resolved" as const } : { status, priority: priority || null, assigned_to: assignee || null };
    const result = await supabase.from("barrier_reports").update(updates).eq("id", report.id).select("id").single();
    if (result.error) throw result.error;
  }, onSuccess: (_, quick) => { toast.success(quick ? "Report marked resolved" : "Report changes saved"); void client.invalidateQueries({ queryKey: ["staff"] }); }, onError: error => toast.error(message(error)) });
  const dirty = status !== report.status || priority !== (report.priority ?? "") || assignee !== (report.assigned_to ?? "");
  return <section className="surface-card space-y-4 p-6"><h2 className="text-xl font-bold">Manage report</h2><p id="workflow-help" className="text-sm leading-relaxed text-muted-foreground">Workflow: {STATUS_FLOW.map(s => STATUS_LABELS[s]).join(" → ")}. Rejected and Duplicate are also available.</p><form className="space-y-5" onSubmit={e => { e.preventDefault(); save.mutate(false); }}><fieldset disabled={save.isPending} className="space-y-5"><legend className="sr-only">Report status, priority and assignment</legend>
    <div className="space-y-2"><Label htmlFor="report-status">Status</Label><select id="report-status" className={selectClass} value={status} aria-describedby="workflow-help" onChange={e => setStatus(e.target.value as ReportStatus)}>{Object.entries(STATUS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="report-priority">Priority</Label><select id="report-priority" className={selectClass} value={priority} onChange={e => setPriority(e.target.value as ReportPriority | "")} aria-describedby="priority-help"><option value="">Not set</option>{Object.entries(PRIORITY_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select><p id="priority-help" className="text-sm leading-relaxed text-muted-foreground">Set priority from the actual risk and operational policy; ClearRoute never guesses it from keywords.</p></div>
    <div className="space-y-2"><Label htmlFor="report-assignee">Assign to</Label><select id="report-assignee" className={selectClass} value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">Unassigned</option>{report.assigned_to && !staff.some(s => s.id === report.assigned_to) && <option value={report.assigned_to}>Current assignee (not in directory)</option>}{staff.map(s => <option key={s.id} value={s.id}>{s.display_name || "Staff member"}</option>)}</select></div>
    <Button className="w-full" disabled={save.isPending || !dirty}>{save.isPending ? "Saving…" : "Save changes"}</Button>
  </fieldset></form><Button variant="success" className="w-full" disabled={save.isPending || report.status === "resolved" || dirty} onClick={() => save.mutate(true)}><CheckCircle2 aria-hidden />Mark resolved</Button>{dirty && <p className="text-sm text-muted-foreground">Save changes first to use the quick resolve action.</p>}</section>;
}

function SignedPhoto({ path, alt }: { path: string; alt: string }) {
  const query = useQuery({ queryKey: ["staff", "signed-photo", path], staleTime: 45 * 60 * 1000, refetchInterval: 50 * 60 * 1000, queryFn: async () => {
    const result = await supabase.storage.from("report-photos").createSignedUrl(path, 3600);
    if (result.error) throw result.error;
    return result.data.signedUrl;
  } });
  const [failed, setFailed] = useState(false);
  if (query.isPending) return <LoadingBlock label="Loading private image…" />;
  if (query.isError || failed) return <div className="space-y-2"><ErrorBlock message={query.isError ? query.error.message : "This image could not be displayed."} /><Button variant="outline" onClick={() => { setFailed(false); void query.refetch(); }}>Retry image</Button></div>;
  return <a href={query.data} target="_blank" rel="noopener noreferrer" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-ring" aria-label={`${alt} — open full image in a new tab`}><img src={query.data} alt={alt} loading="lazy" className="h-56 w-full rounded-lg border border-border bg-muted object-contain" onError={() => setFailed(true)} /></a>;
}

function AuditDetails({ details }: { details: unknown }) {
  if (!details) return <p className="text-sm text-muted-foreground">No additional details.</p>;
  const render = (value: unknown): string => value === null || value === undefined ? "Not set" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (typeof details !== "object" || Array.isArray(details)) return <p className="break-words text-sm">{render(details)}</p>;
  const object = details as Record<string, unknown>;
  // Trigger payloads may represent transitions as old/new or from/to.
  const previous = object["old"] ?? object["from"] ?? object["old_status"];
  const next = object["new"] ?? object["to"] ?? object["new_status"];
  return <div className="space-y-2 break-words text-sm">{(previous !== undefined || next !== undefined) && <p><span className="font-medium">Change: </span>{render(previous)} → {render(next)}</p>}<dl className="space-y-1">{Object.entries(object).map(([key, value]) => <div key={key}><dt className="inline font-medium">{key.replaceAll("_", " ")}: </dt><dd className="inline">{render(value)}</dd></div>)}</dl></div>;
}
