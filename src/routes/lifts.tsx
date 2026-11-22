import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpDown, Bell, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { campusDataQuery, useCampusRealtime } from "@/lib/campus-data";
import { useAuth } from "@/lib/auth";
import { liftConfirmedOperational } from "@/lib/routing/rules";
import { LIFT_STATUS_LABELS, formatDate, timeAgo } from "@/lib/labels";
import type { LiftRow, LiftStatusValue } from "@/lib/db-types";
import { PageHeader, EmptyState, ErrorBlock, LoadingBlock } from "@/components/common/PageHeader";
import { DemoBanner } from "@/components/common/DemoBanner";
import { DemoPill } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/lifts")({
  head: () => ({
    meta: [
      { title: "Lift availability – SugamPath LPU" },
      { name: "description", content: "Current operational status of campus lifts, when each was last updated, and alternatives during outages." },
      { property: "og:title", content: "Lift availability – SugamPath LPU" },
      { property: "og:description", content: "Check which campus lifts are operational before you travel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiftsPage,
});

const STATUSES: LiftStatusValue[] = ["operational", "out_of_service", "under_maintenance", "unknown"];

function LiftsPage() {
  const q = useQuery(campusDataQuery);
  useCampusRealtime();
  const { canManageLifts } = useAuth();
  const updates = useQuery({
    queryKey: ["campus-updates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").is("user_id", null).order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const data = q.data;
  const ctx = data ? { now: new Date(), freshnessDays: data.settings.verification_freshness_days, liftFreshnessHours: data.settings.lift_status_freshness_hours } : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        title="Live Lifts"
        description={<>Timestamps & Operator. Wheelchair routes only use lifts confirmed in the last {data?.settings.lift_status_freshness_hours ?? 24} hours.</>}
        actions={<Button asChild variant="hero"><Link to="/report">Report a lift problem</Link></Button>}
      />
      {data?.lifts.some((l) => l.is_demo) && <DemoBanner compact />}
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock message={q.error.message} /> : !data || data.lifts.length === 0 ? (
        <EmptyState icon={<ArrowUpDown aria-hidden />} title="No lifts recorded yet">Lifts appear here once their locations have been added to the campus database.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.lifts.map((l) => (
            <LiftCard key={l.id} lift={l} placeName={data.nodes.find((n) => n.id === l.node_id)?.name} state={liftConfirmedOperational(l, ctx!)} canManage={canManageLifts} />
          ))}
        </ul>
      )}

      <section aria-labelledby="updates-title" className="surface-card p-5">
        <h2 id="updates-title" className="flex items-center gap-2 text-xl font-bold"><Bell className="size-5" aria-hidden /> Recent campus updates</h2>
        {updates.isPending ? <p className="mt-2 text-muted-foreground">Loading…</p> : updates.data?.length ? (
          <ul className="mt-3 divide-y divide-border">
            {updates.data.map((u) => (
              <li key={u.id} className="py-2.5">
                <p className="font-semibold">{u.title}</p>
                {u.body && <p className="text-muted-foreground">{u.body}</p>}
                <p className="text-sm text-muted-foreground">{formatDate(u.created_at, true)}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-muted-foreground">No lift or pathway changes have been recorded yet.</p>}
      </section>
    </div>
  );
}

const CARD_STYLE: Record<string, { card: string; pill: string; label: string }> = {
  ok: { card: "border-success/50 bg-success/8", pill: "bg-success text-success-foreground", label: "WORKING" },
  stale: { card: "border-warning/70 bg-warning/10", pill: "bg-warning text-warning-foreground", label: "NOT CONFIRMED" },
  out_of_service: { card: "border-destructive/50 bg-destructive/8", pill: "bg-destructive text-destructive-foreground", label: "LOCKED / OUT" },
  under_maintenance: { card: "border-warning/70 bg-warning/10", pill: "bg-warning text-warning-foreground", label: "MAINTENANCE" },
  unknown: { card: "border-border bg-card", pill: "bg-muted-foreground text-card", label: "UNKNOWN" },
};

function LiftCard({ lift: l, placeName, state, canManage }: { lift: LiftRow; placeName: string | undefined; state: "ok" | "stale" | "down"; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const key = l.status === "operational" ? (state === "ok" ? "ok" : "stale") : l.status;
  const st = CARD_STYLE[key] ?? CARD_STYLE["unknown"]!;
  const down = l.status !== "operational";
  return (
    <li className={`rounded-2xl border-2 p-5 shadow-sm ${st.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{l.label}</h2>
          <p className="text-sm text-muted-foreground">{placeName ?? "Location not linked"}{l.location_description ? ` · ${l.location_description}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-extrabold tracking-wide ${st.pill}`} aria-live="polite">{st.label}</span>
      </div>
      <p className="mt-3 text-sm">
        {l.status_updated_at ? <>Updated <strong>{timeAgo(l.status_updated_at)}</strong> by {l.status_updated_by ? "Operator" : "System"} · {formatDate(l.status_updated_at, true)}</> : "Status never confirmed"}
      </p>
      <p className="sr-only">Status: {LIFT_STATUS_LABELS[l.status]}{state === "stale" ? ", not confirmed recently" : ""}</p>
      {l.issue && <p className="mt-2 text-sm"><strong>Issue:</strong> {l.issue}</p>}
      {l.alternative_info && <p className={`mt-2 text-sm font-semibold ${down ? "text-destructive" : ""}`}>Alt: {l.alternative_info}</p>}
      {l.is_demo && <div className="mt-2"><DemoPill /></div>}
      {canManage ? (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`mt-3 text-sm font-bold underline underline-offset-4 ${down ? "text-destructive" : "text-success"}`}>
          {open ? "Close status update" : "Tap to Confirm Status"}
        </button>
      ) : (
        <Link to="/report" className={`mt-3 inline-block text-sm font-bold underline underline-offset-4 ${down ? "text-destructive" : "text-success"}`}>Something wrong? Report it</Link>
      )}
      {canManage && open && <LiftUpdateForm lift={l} />}
    </li>
  );
}

function LiftUpdateForm({ lift }: { lift: LiftRow }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<LiftStatusValue>(lift.status);
  const [issue, setIssue] = useState(lift.issue ?? "");
  const [alt, setAlt] = useState(lift.alternative_info ?? "");
  const history = useQuery({
    queryKey: ["lift-history", lift.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("lift_status_history").select("*").eq("lift_id", lift.id).order("changed_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });
  const m = useMutation({
    mutationFn: async (confirmOnly: boolean) => {
      const payload = confirmOnly
        ? { status: lift.status, status_updated_at: new Date().toISOString() }
        : { status, issue: issue.trim() || null, alternative_info: alt.trim() || null, status_updated_at: new Date().toISOString() };
      const { error } = await supabase.from("lifts").update(payload).eq("id", lift.id);
      if (error) throw error;
    },
    onSuccess: (_d, confirmOnly) => {
      toast.success(confirmOnly ? "Status re-confirmed" : "Lift status updated. Routes have been recalculated.");
      void qc.invalidateQueries({ queryKey: ["campus-data"] });
      void qc.invalidateQueries({ queryKey: ["lift-history", lift.id] });
      void qc.invalidateQueries({ queryKey: ["campus-updates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={(e) => { e.preventDefault(); m.mutate(false); }}>
      <p className="font-bold">Update status (staff)</p>
      <div className="space-y-1">
        <Label htmlFor={`st-${lift.id}`}>Status</Label>
        <select id={`st-${lift.id}`} value={status} onChange={(e) => setStatus(e.target.value as LiftStatusValue)} className="h-11 w-full rounded-lg border border-input bg-background px-3">
          {STATUSES.map((s) => <option key={s} value={s}>{LIFT_STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`is-${lift.id}`}>Reported issue (optional)</Label>
        <Textarea id={`is-${lift.id}`} value={issue} onChange={(e) => setIssue(e.target.value)} maxLength={300} rows={2} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`al-${lift.id}`}>Alternative information (optional)</Label>
        <Textarea id={`al-${lift.id}`} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} rows={2} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={m.isPending}>Save status</Button>
        {lift.status === "operational" && <Button type="button" variant="outline" disabled={m.isPending} onClick={() => m.mutate(true)}>Re-confirm operational now</Button>}
      </div>
      {history.data && history.data.length > 0 && (
        <details>
          <summary className="flex cursor-pointer items-center gap-1.5 py-1 font-semibold text-primary"><History className="size-4" aria-hidden /> Status history</summary>
          <ul className="mt-1 space-y-1 text-sm">
            {history.data.map((h) => <li key={h.id}>{formatDate(h.changed_at, true)}: {h.old_status ? LIFT_STATUS_LABELS[h.old_status] : "—"} → {LIFT_STATUS_LABELS[h.new_status]}{h.issue ? ` (${h.issue})` : ""}</li>)}
          </ul>
        </details>
      )}
    </form>
  );
}
