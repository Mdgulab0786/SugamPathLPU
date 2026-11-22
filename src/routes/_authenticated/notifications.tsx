import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/labels";
import { PageHeader, EmptyState, ErrorBlock, LoadingBlock } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/common/badges";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications – SugamPath LPU" },
      { name: "description", content: "Your report updates, lift status changes and campus route disruptions." },
      { property: "og:title", content: "Notifications – SugamPath LPU" },
      { property: "og:description", content: "In-app notifications from SugamPath LPU." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["me", "notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").or(`user_id.eq.${user!.id},user_id.is.null`).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["me"] }); toast.success("All marked as read"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["me"] });
  };
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader title="Notifications" description="Personal updates about your reports, plus campus-wide lift and pathway updates. Email delivery is not enabled — notifications appear here only." actions={<Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}><CheckCheck aria-hidden /> Mark all as read</Button>} />
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock message={q.error.message} /> : q.data.length === 0 ? (
        <EmptyState icon={<Bell aria-hidden />} title="No notifications yet" />
      ) : (
        <ul className="space-y-2">
          {q.data.map((n) => {
            const unread = n.user_id && !n.read_at;
            return (
              <li key={n.id} className={`surface-card p-4 ${unread ? "border-l-4 border-l-primary" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {unread && <Pill tone="info">Unread</Pill>}
                  {!n.user_id && <Pill tone="neutral">Campus update</Pill>}
                  <p className="font-bold">{n.title}</p>
                </div>
                {n.body && <p className="mt-1 text-muted-foreground">{n.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{formatDate(n.created_at, true)}</span>
                  {n.link && <a href={n.link} onClick={() => unread && void markOne(n.id)} className="font-semibold text-primary underline underline-offset-4">View</a>}
                  {unread && <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => void markOne(n.id)}>Mark as read</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">Looking for a specific report? <Link to="/my-reports" className="text-primary underline">My reports</Link></p>
    </div>
  );
}
