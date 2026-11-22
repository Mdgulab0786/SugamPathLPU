import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ClipboardList, Inbox, SearchCheck, UserCheck, Wrench, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/common/RoleGate";
import { PageHeader, LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/PageHeader";
import { ReportStatusBadge, PriorityBadge } from "@/components/common/badges";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, STATUS_LABELS, PRIORITY_LABELS, formatDate } from "@/lib/labels";
import type { ReportRow } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/staff/")({
  head: () => ({ meta: [
    { title: "Estate dashboard – SugamPath LPU" },
    { name: "description", content: "Manage campus accessibility reports, priorities and estate team assignments." },
    { property: "og:title", content: "Estate dashboard – SugamPath LPU" },
    { property: "og:description", content: "Private estate team overview of campus accessibility reports and operational progress." },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => <RoleGate need="staff"><Dashboard /></RoleGate>,
});
const selectClass = "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";

function Dashboard() {
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["staff", "dashboard"],
    queryFn: async () => {
      // Fetch every page: Supabase's default row limit must not truncate totals.
      const reports: ReportRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await supabase.from("barrier_reports").select("*").order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
        if (result.error) throw result.error;
        reports.push(...result.data);
        if (result.data.length < 1000) break;
      }
      const nodes: { id: string; name: string }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await supabase.from("route_nodes").select("id,name").order("id").range(offset, offset + 999);
        if (result.error) throw result.error;
        nodes.push(...result.data);
        if (result.data.length < 1000) break;
      }
      const staff = await supabase.rpc("list_staff");
      if (staff.error) throw staff.error;
      return { reports, nodes, staff: staff.data };
    },
  });
  if (query.isPending) return <div className="mx-auto max-w-7xl px-4 py-10"><LoadingBlock label="Loading estate dashboard…" /></div>;
  if (query.isError) return <div className="mx-auto max-w-7xl space-y-4 px-4 py-10"><ErrorBlock message={query.error.message} /><Button onClick={() => void query.refetch()}>Retry dashboard</Button></div>;
  const { reports, nodes, staff } = query.data;
  const nodeNames = new Map(nodes.map(n => [n.id, n.name]));
  const staffNames = new Map(staff.map(s => [s.id, s.display_name || "Staff member"]));
  const location = (r: ReportRow) => (r.node_id ? nodeNames.get(r.node_id) : null) || r.location_text || "Location not recorded";
  const needle = search.trim().toLowerCase();
  const filtered = reports.filter(r => (!status || r.status === status) && (!category || r.category === category) && (!priority || (priority === "unset" ? !r.priority : r.priority === priority)) && (!needle || [r.code, r.description, r.location_text, location(r)].some(value => value?.toLowerCase().includes(needle))));
  const categories = Object.entries(CATEGORY_LABELS).map(([key, name]) => ({ name, count: reports.filter(r => r.category === key).length }));
  const locations = new Map<string, number>();
  reports.forEach(r => { const name = location(r); locations.set(name, (locations.get(name) ?? 0) + 1); });
  const topLocations = [...locations].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const stats = [
    { name: "Total reports", value: reports.length, Icon: ClipboardList },
    { name: "New", value: reports.filter(r => r.status === "new").length, Icon: Inbox },
    { name: "Under review", value: reports.filter(r => r.status === "under_review").length, Icon: SearchCheck },
    { name: "Assigned", value: reports.filter(r => r.status === "assigned").length, Icon: UserCheck },
    { name: "In progress", value: reports.filter(r => r.status === "in_progress").length, Icon: Wrench },
    { name: "Resolved", value: reports.filter(r => r.status === "resolved").length, Icon: CheckCircle2 },
  ];
  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-10">
    <PageHeader eyebrow="SugamPath LPU · Estate operations" title="Estate team dashboard" description="Review accessibility barriers and coordinate the next step. Overview figures include all reports." />
    <section aria-label="Report statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{stats.map(({ name, value, Icon }) => <div key={name} className="surface-card space-y-2 p-5"><Icon aria-hidden className="size-6 text-primary" /><p className="text-sm font-medium text-muted-foreground">{name}</p><p className="text-3xl font-bold tabular-nums">{value}</p></div>)}</section>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="surface-card min-w-0 p-6" aria-labelledby="categories-title"><h2 id="categories-title" className="text-xl font-bold">Reports by category</h2>
        <div className="mt-4 h-80" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={categories} layout="vertical" margin={{ left: 0, right: 24 }}><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={155} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="count" name="Reports" fill="var(--color-primary)" radius={4} /></BarChart></ResponsiveContainer></div>
        <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 font-medium text-primary">View category counts as text</summary><ul className="space-y-2">{categories.map(c => <li key={c.name} className="flex justify-between gap-4"><span>{c.name}</span><strong>{c.count}</strong></li>)}</ul></details>
      </section>
      <section className="surface-card p-6" aria-labelledby="locations-title"><h2 id="locations-title" className="text-xl font-bold">Frequently reported locations</h2><p className="mt-2 text-muted-foreground">Top five locations across all reports.</p>{topLocations.length ? <ol className="mt-5 divide-y divide-border">{topLocations.map(([name, count]) => <li key={name} className="flex items-center justify-between gap-4 py-4"><span>{name}</span><span className="shrink-0 rounded-full bg-muted px-3 py-1 font-semibold">{count} {count === 1 ? "report" : "reports"}</span></li>)}</ol> : <p className="mt-6 text-muted-foreground">No reported locations yet.</p>}</section>
    </div>
    <section aria-labelledby="reports-title" className="space-y-5"><h2 id="reports-title" className="text-2xl font-bold">Report management</h2>
      <div className="surface-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><Label htmlFor="staff-search">Search reports</Label><Input id="staff-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Code, description or location" /></div>
        <div className="space-y-2"><Label htmlFor="staff-status">Status</Label><select id="staff-status" className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="staff-category">Category</Label><select id="staff-category" className={selectClass} value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="staff-priority">Priority</Label><select id="staff-priority" className={selectClass} value={priority} onChange={e => setPriority(e.target.value)}><option value="">All priorities</option><option value="unset">Not set</option>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <Button variant="outline" onClick={() => { setStatus(""); setCategory(""); setPriority(""); setSearch(""); }}>Clear filters</Button>
      </div>
      <p role="status" className="text-muted-foreground">{filtered.length} of {reports.length} reports · Newest first</p>
      {!filtered.length ? <EmptyState icon={<ClipboardList aria-hidden />} title={reports.length ? "No reports match these filters" : "No reports yet"}>{reports.length ? "Try another search or clear your filters." : "Campus accessibility reports will appear here when submitted."}</EmptyState> : <div className="surface-card overflow-x-auto" role="region" aria-label="Report management table" tabIndex={0}><table className="w-full min-w-[1100px] text-left text-base"><caption className="sr-only">Accessibility reports, newest first</caption><thead className="border-b border-border bg-muted"><tr>{["Report ID", "Category", "Location", "Submitted", "Priority", "Status", "Assigned to", "Actions"].map(h => <th key={h} scope="col" className="p-4 font-semibold">{h}</th>)}</tr></thead><tbody>{filtered.map(r => <tr key={r.id} className="border-b border-border last:border-0"><th scope="row" className="whitespace-nowrap p-4 font-semibold">{r.code}</th><td className="p-4">{CATEGORY_LABELS[r.category]}</td><td className="p-4">{location(r)}</td><td className="whitespace-nowrap p-4">{formatDate(r.created_at)}</td><td className="p-4"><PriorityBadge priority={r.priority} /></td><td className="p-4"><ReportStatusBadge status={r.status} /></td><td className="p-4">{r.assigned_to ? staffNames.get(r.assigned_to) ?? "Staff member" : "Unassigned"}</td><td className="p-4"><Link to="/staff/reports/$id" params={{ id: r.id }} aria-label={`Open report ${r.code}`} className="inline-flex min-h-11 items-center rounded-md px-3 font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Open</Link></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
