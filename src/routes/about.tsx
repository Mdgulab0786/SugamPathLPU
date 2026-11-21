import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About ClearRoute – how verified accessible routing works" },
      { name: "description", content: "How ClearRoute builds accessible routes from surveyed LPU campus data, and why unknown accessibility is never shown as accessible." },
      { property: "og:title", content: "About ClearRoute" },
      { property: "og:description", content: "How ClearRoute verifies campus routes, ramps and lifts." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader eyebrow="About" title="About ClearRoute" description="Every journey should have a barrier-free path." />
      <div className="space-y-5 text-lg leading-relaxed">
        <p>Accessible routes on ordinary maps can fail in real life: ramps end at steps, lifts are out of service, entrances are locked and pathways get blocked. ClearRoute helps students and staff with mobility constraints check reliable route information before they set off, and helps the estate team find and fix barriers.</p>
        <h2 className="text-2xl font-bold">How routes are calculated</h2>
        <p>The campus is stored as a network of places (entrances, junctions, buildings, lifts, ramps) connected by pathways. Each pathway records its distance, surface, clear width, slope, steps, kerbs, ramps, lift dependency, current barrier status and when it was last verified. ClearRoute applies hard safety rules first — for example strict wheelchair mode never uses steps, blocked pathways, unverified ramps or lifts not confirmed operational — and only then ranks the remaining options by your preferences.</p>
        <h2 className="text-2xl font-bold">What "verified" means</h2>
        <p>A pathway is verified only when authorised staff record an on-site inspection with a date, the person or role responsible and an evidence reference. Creating or importing data never verifies it, and changing a measured attribute resets verification. Verifications older than the configured freshness period are shown as out of date. A route is labelled "Verified" only when every section is currently verified and fully measured.</p>
        <h2 className="text-2xl font-bold">Demo data</h2>
        <p>Until surveyed LPU data is entered, ClearRoute runs in demo mode with clearly labelled synthetic places and pathways. They exist only to demonstrate the system and are not real LPU accessibility information.</p>
        <h2 className="text-2xl font-bold">Campus support</h2>
        <p>For urgent assistance, contact LPU's estate, security or student welfare offices through the university's official, published channels. ClearRoute does not publish phone numbers it cannot verify. To tell the estate team about a problem, <Link to="/report" className="font-semibold text-primary underline underline-offset-4">report a barrier</Link>.</p>
      </div>
    </div>
  );
}
