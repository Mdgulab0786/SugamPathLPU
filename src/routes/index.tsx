import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Map, Navigation, ShieldCheck, ArrowUpDown, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClearRoute – Accessible Campus Navigation for LPU" },
      { name: "description", content: "Find a safer, step-free way around LPU campus, check lift status and report accessibility barriers." },
      { property: "og:title", content: "ClearRoute – Accessible Campus Navigation" },
      { property: "og:description", content: "Every journey should have a barrier-free path. Verified accessible routes, lift status and barrier reporting for LPU." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function RouteIllustration() {
  return (
    <svg viewBox="0 0 360 300" role="img" aria-label="Illustration of a route that avoids steps and uses a ramp" className="h-auto w-full max-w-md">
      <rect x="0" y="0" width="360" height="300" rx="24" className="fill-navy-foreground/5" />
      <path d="M40 250 L40 170 L140 170" className="stroke-navy-foreground/30" strokeWidth="8" strokeDasharray="6 10" fill="none" strokeLinecap="round" />
      <path d="M140 170 L140 80 L300 80" className="stroke-destructive" strokeWidth="8" strokeDasharray="4 10" fill="none" strokeLinecap="round" />
      <path d="M40 250 L200 250 L250 200 L300 200 L300 80" className="stroke-accent" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g className="fill-accent"><circle cx="40" cy="250" r="14" /><circle cx="300" cy="80" r="14" /></g>
      <circle cx="225" cy="225" r="12" className="fill-success" />
      <circle cx="140" cy="120" r="12" className="fill-destructive" />
      <text x="140" y="125" textAnchor="middle" className="fill-navy-foreground text-[13px] font-bold">!</text>
      <text x="225" y="230" textAnchor="middle" className="fill-navy-foreground text-[12px] font-bold">R</text>
      <text x="58" y="282" className="fill-navy-foreground text-[14px] font-semibold">Start</text>
      <text x="262" y="58" className="fill-navy-foreground text-[14px] font-semibold">Destination</text>
      <text x="152" y="152" className="fill-navy-foreground/80 text-[12px]">Steps – avoided</text>
      <text x="196" y="280" className="fill-navy-foreground/80 text-[12px]">Verified ramp</text>
    </svg>
  );
}

function Index() {
  const actions = [
    { to: "/route", label: "Find Accessible Route", icon: Navigation, variant: "hero" as const },
    { to: "/report", label: "Report a Barrier", icon: AlertTriangle, variant: "onDark" as const },
    { to: "/lifts", label: "Check Lift Availability", icon: ArrowUpDown, variant: "onDark" as const },
    { to: "/map", label: "Explore Campus Accessibility", icon: Map, variant: "onDark" as const },
  ];
  const features = [
    { icon: Navigation, title: "Accessible Navigation", text: "Routes are calculated on a surveyed campus pathway network. Strict wheelchair mode never uses steps, blocked paths, unverified ramps or unconfirmed lifts." },
    { icon: BellRing, title: "Real-Time Barrier Reporting", text: "Report a broken ramp, locked entrance or blocked path in under a minute — with an optional photo — and track it with your report ID." },
    { icon: Building2, title: "Campus Accessibility Updates", text: "Lift outages and pathway closures change route results immediately and appear as campus updates, with the time they were last confirmed." },
  ];
  return (
    <>
      <section className="bg-hero text-navy-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:grid-cols-[1.25fr_1fr] md:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-navy-foreground/10 px-3 py-1 text-sm font-semibold">
              <ShieldCheck className="size-4" aria-hidden /> Lovely Professional University · Phagwara
            </p>
            <h1 className="mt-5 text-5xl font-extrabold md:text-6xl">ClearRoute</h1>
            <p className="mt-2 text-2xl font-semibold text-accent md:text-3xl">Accessible Campus Navigation</p>
            <p className="mt-5 max-w-xl text-xl text-navy-foreground/90">Find a safer and more accessible way around campus.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {actions.map((a) => (
                <Button key={a.to} asChild variant={a.variant} size="lg" className="justify-start whitespace-normal text-left">
                  <Link to={a.to}>
                    <a.icon aria-hidden /> {a.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <RouteIllustration />
          </div>
        </div>
      </section>

      <section aria-labelledby="features" className="mx-auto max-w-7xl px-4 py-14">
        <h2 id="features" className="text-3xl font-bold">What ClearRoute does</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="surface-card p-6">
              <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
                <f.icon className="size-7" aria-hidden />
              </span>
              <h3 className="mt-4 text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="honest" className="mx-auto max-w-7xl px-4 pb-6">
        <div className="surface-card grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
          <ShieldCheck className="size-12 text-success" aria-hidden />
          <div>
            <h2 id="honest" className="text-2xl font-bold">Honest route information</h2>
            <p className="mt-2 text-lg text-muted-foreground">
              Route information is based only on recorded and verified campus data. Every route shows when each section was last checked.
              Unknown accessibility is never treated as accessible, and if no sufficiently verified route exists, ClearRoute tells you so instead of guessing.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                "Ramps are only trusted after an on-site verification",
                "Lifts are only used when confirmed operational",
                "Stale survey data is clearly marked",
                "Blocked pathways are removed from routes",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-5 shrink-0 text-success" aria-hidden />{t}</li>
              ))}
            </ul>
            <Link to="/about" className="mt-4 inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:no-underline">
              How verification works <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
