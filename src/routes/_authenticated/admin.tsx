import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Download } from "lucide-react";
import { RoleGate } from "@/components/common/RoleGate";
import { PageHeader, ErrorBlock, LoadingBlock } from "@/components/common/PageHeader";
import { DemoBanner } from "@/components/common/DemoBanner";
import { VerificationBadge, DemoPill } from "@/components/common/badges";
import { VerifyForm } from "@/components/admin/forms";
import { useAdminData } from "@/components/admin/useAdminData";
import { computeReadiness } from "@/lib/admin/readiness";
import { download, edgesToCsv, nodesToCsv, toGeoJson, templateCsv, NODE_COLUMNS, EDGE_COLUMNS, AUDIT_COLUMNS } from "@/lib/admin/import";
import { formatDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Map administration – ClearRoute" },
      { name: "description", content: "Verify campus pathways, export route data and check production readiness." },
      { property: "og:title", content: "Map administration – ClearRoute" },
      { property: "og:description", content: "ClearRoute route and map data administration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <RoleGate need="staff"><Admin /></RoleGate>,
});

function Admin() {
  const q = useAdminData();
  const [verifying, setVerifying] = useState<string | null>(null);
  if (q.isPending) return <div className="mx-auto max-w-6xl px-4 py-8"><LoadingBlock /></div>;
  if (q.isError) return <div className="mx-auto max-w-6xl px-4 py-8"><ErrorBlock message={q.error.message} /></div>;
  const { nodes, edges, lifts, settings } = q.data;
  const readiness = computeReadiness(nodes, edges, lifts, settings, new Date());
  const name = (id: string) => nodes.find((n) => n.id === id)?.name ?? "?";
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader title="Map administration" description="Verify pathways after on-site surveys, download templates and export data." />
      {settings.demo_mode && <DemoBanner compact />}
      <section className="surface-card p-5">
        <h2 className="text-xl font-bold">Production readiness check</h2>
        <ul className="mt-3 space-y-2">
          {readiness.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              {r.status === "pass" ? <CheckCircle2 className="mt-1 size-5 text-success" aria-hidden /> : r.status === "warn" ? <AlertTriangle className="mt-1 size-5 text-warning" aria-hidden /> : <XCircle className="mt-1 size-5 text-destructive" aria-hidden />}
              <span><strong>{r.label}</strong> ({r.status}) — {r.detail}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="surface-card flex flex-wrap gap-2 p-5">
        <h2 className="w-full text-xl font-bold">Templates & export</h2>
        <Button variant="outline" onClick={() => download("nodes-template.csv", templateCsv(NODE_COLUMNS), "text/csv")}><Download aria-hidden /> Places template</Button>
        <Button variant="outline" onClick={() => download("pathways-template.csv", templateCsv(EDGE_COLUMNS), "text/csv")}><Download aria-hidden /> Pathways template</Button>
        <Button variant="outline" onClick={() => download("route-audit-form.csv", templateCsv(AUDIT_COLUMNS), "text/csv")}><Download aria-hidden /> Route audit form</Button>
        <Button variant="outline" onClick={() => download("clearroute.geojson", JSON.stringify(toGeoJson(nodes, edges), null, 2), "application/geo+json")}><Download aria-hidden /> Export GeoJSON</Button>
        <Button variant="outline" onClick={() => { download("places.csv", nodesToCsv(nodes), "text/csv"); download("pathways.csv", edgesToCsv(edges, nodes), "text/csv"); }}><Download aria-hidden /> Export CSV</Button>
      </section>
      <section className="surface-card p-5">
        <h2 className="text-xl font-bold">Pathways</h2>
        <ul className="mt-3 divide-y divide-border">
          {edges.map((e) => (
            <li key={e.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{e.name ?? "Pathway"}</span>
                <span className="text-muted-foreground">{name(e.from_node_id)} ↔ {name(e.to_node_id)}</span>
                <VerificationBadge status={e.verification_status} demo={e.is_demo} />
                {e.is_demo && <DemoPill />}
                <span className="text-sm text-muted-foreground">Last verified {formatDate(e.last_verified_at)}</span>
                <Button size="sm" variant="outline" onClick={() => setVerifying(verifying === e.id ? null : e.id)}>Verify</Button>
              </div>
              {verifying === e.id && <div className="mt-3"><VerifyForm target={{ type: "edge", id: e.id, name: e.name ?? "Pathway" }} onDone={() => setVerifying(null)} /></div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
