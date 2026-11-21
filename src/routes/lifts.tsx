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
import { DemoPill, LiftStatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/lifts")({
  head: () => ({
    meta: [
      { title: "Lift availability – ClearRoute" },
      { name: "description", content: "Current operational status of campus lifts, when each was last updated, and alternatives during outages." },
      { property: "og:title", content: "Lift availability – ClearRoute" },
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
        title="Lift availability"
        description={<>Lift status is shown only as recorded by authorised staff. If a status has not been confirmed in the last {data?.settings.lift_status_freshness_hours ?? 24} hours, strict wheelchair routes will not depend on it.</>}
        actions={<Button asChild variant="outline"><Link to="/report">Report a lift problem</Link></Button>}
      />
      {data?.lifts.some((l) => l.is_demo) && <DemoBanner compact />}
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock message={q.error.message} /> : !data || data.lifts.length === 0 ? (
        <EmptyState icon={<ArrowUpDown aria-hidden />} title="No lifts recorded yet">Lifts appear here once their locations have been added to the campus database.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.lifts.map((l) => {
            const node = data.nodes.find((n) => n.id === l.node_id);
            const state = liftConfirmedOperational(l, ctx!);
            return (
              <li key={l.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold">{l.label}</h2>
                    <p className="text-muted-foreground">{node?.name ?? "Location not linked"}{l.location_description ? ` · ${l.location_description}` : ""}</p>
                  </div>
                  {l.is_demo && <DemoPill />}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
                  <LiftStatusBadge status={l.status} stale={state === "stale"} />
                  <span className="text-sm text-muted-foreground">Last updated {l.status_updated_at ? `${formatDate(l.status_updated_at, true)} (${timeAgo(l.status_updated_at)})` : "never"}</span>
                </div>
                {l.issue && <p className="mt-3"><strong>Reported issue:</strong> {l.issue}</p>}
                {l.alternative_info && <p className="mt-2"><strong>Alternative:</strong> {l.alternative_info}</p>}
                {canManageLifts && <LiftUpdateForm lift={l} />}
              </li>
            );
          })}
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
