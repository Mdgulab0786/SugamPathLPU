import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { CheckCircle2, Circle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABELS, STATUS_FLOW, STATUS_LABELS, formatDate } from "@/lib/labels";
import type { ReportCategory, ReportStatus } from "@/lib/db-types";
import { PageHeader, ErrorBlock, LoadingBlock } from "@/components/common/PageHeader";
import { ReportStatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/track")({
  validateSearch: (s) => z.object({ code: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Track a barrier report – ClearRoute" },
      { name: "description", content: "Check the progress of an accessibility barrier report using its ClearRoute report ID." },
      { property: "og:title", content: "Track a barrier report – ClearRoute" },
      { property: "og:description", content: "Enter your report ID to see its current status and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

interface Tracked {
  code: string;
  category: ReportCategory;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  history: { status: ReportStatus; at: string }[];
}

function TrackPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [input, setInput] = useState(search.code ?? "");
  const code = search.code?.trim().toUpperCase() ?? "";
  const q = useQuery({
    queryKey: ["track", code],
    enabled: /^CR-[A-F0-9]{8}$/.test(code),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("track_report", { p_code: code });
      if (error) throw error;
      return (data as unknown as Tracked | null) ?? null;
    },
  });
  const [err, setErr] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const c = input.trim().toUpperCase();
    if (!/^CR-[A-F0-9]{8}$/.test(c)) { setErr("Report IDs look like CR-1A2B3C4D."); return; }
    setErr(null);
    void navigate({ search: { code: c } });
  }

  const r = q.data;
  const terminal = r && (r.status === "rejected" || r.status === "duplicate");
  const reachedIdx = r ? STATUS_FLOW.indexOf(r.status) : -1;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader title="Track a report" description="Enter the report ID you received when you submitted a barrier report." />
      <form onSubmit={submit} className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-end" noValidate>
        <div className="flex-1">
          <Label htmlFor="code" className="text-base font-bold">Report ID</Label>
          <Input id="code" value={input} onChange={(e) => setInput(e.target.value)} placeholder="CR-1A2B3C4D" className="mt-1.5 h-12 font-mono text-lg uppercase" autoComplete="off" aria-invalid={!!err} aria-describedby={err ? "code-error" : undefined} />
          {err && <p id="code-error" className="mt-1 font-semibold text-destructive">{err}</p>}
        </div>
        <Button type="submit" size="lg"><Search aria-hidden /> Check status</Button>
      </form>

      {code && q.isPending && q.fetchStatus !== "idle" && <LoadingBlock label="Looking up report…" />}
      {q.isError && <ErrorBlock message={q.error.message} />}
      {code && q.isSuccess && !r && <ErrorBlock message={`No report found with ID ${code}. Check the ID and try again.`} />}
      {r && (
        <section className="surface-card p-6" aria-labelledby="rep-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="rep-title" className="font-mono text-2xl font-bold">{r.code}</h2>
              <p className="text-muted-foreground">{CATEGORY_LABELS[r.category]} · submitted {formatDate(r.created_at, true)}</p>
            </div>
            <ReportStatusBadge status={r.status} />
          </div>
          {terminal ? (
            <p className="mt-5 rounded-lg bg-muted p-4">This report was marked <strong>{STATUS_LABELS[r.status]}</strong> by the estate team.</p>
          ) : (
            <ol className="mt-6 grid gap-3 sm:grid-cols-5" aria-label="Progress">
              {STATUS_FLOW.map((s, i) => {
                const reached = i <= reachedIdx;
                return (
                  <li key={s} className="flex items-center gap-2 sm:flex-col sm:text-center">
                    {reached ? <CheckCircle2 className="size-7 text-success" aria-hidden /> : <Circle className="size-7 text-muted-foreground" aria-hidden />}
                    <span className={reached ? "font-bold" : "text-muted-foreground"}>{STATUS_LABELS[s]}<span className="sr-only">{reached ? " (reached)" : " (not yet)"}</span></span>
                  </li>
                );
              })}
            </ol>
          )}
          <h3 className="mt-6 font-bold">History</h3>
          <ul className="mt-2 space-y-1">
            {r.history.map((h, i) => <li key={i}>{formatDate(h.at, true)} — {STATUS_LABELS[h.status]}</li>)}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">Last updated {formatDate(r.updated_at, true)}.</p>
        </section>
      )}
    </div>
  );
}
