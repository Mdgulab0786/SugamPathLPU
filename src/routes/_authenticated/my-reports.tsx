import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORY_LABELS, formatDate } from "@/lib/labels";
import { PageHeader, EmptyState, ErrorBlock, LoadingBlock } from "@/components/common/PageHeader";
import { ReportStatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/my-reports")({
  head: () => ({
    meta: [
      { title: "My reports – SugamPath LPU" },
      { name: "description", content: "Track the accessibility barrier reports you have submitted to the LPU estate team." },
      { property: "og:title", content: "My reports – SugamPath LPU" },
      { property: "og:description", content: "Your submitted accessibility reports and their current status." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyReports,
});

function MyReports() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["me", "reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("barrier_reports").select("id, code, category, status, created_at, updated_at, location_text").eq("reporter_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <PageHeader title="My reports" description="Reports you submitted while signed in. Anonymous reports can be tracked with their report ID." actions={<Button asChild><Link to="/report"><Plus aria-hidden /> New report</Link></Button>} />
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock message={q.error.message} /> : q.data.length === 0 ? (
        <EmptyState icon={<FileText aria-hidden />} title="You haven't submitted any reports yet">When you report a barrier while signed in, it will appear here with its status.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {q.data.map((r) => (
            <li key={r.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-mono text-lg font-bold">{r.code}</p>
                <p className="text-muted-foreground">{CATEGORY_LABELS[r.category]}{r.location_text ? ` · ${r.location_text}` : ""} · {formatDate(r.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <ReportStatusBadge status={r.status} />
                <Button asChild variant="outline" size="sm"><Link to="/track" search={{ code: r.code }}>Details</Link></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
