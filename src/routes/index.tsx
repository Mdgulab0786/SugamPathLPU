import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, CheckCircle2, Contrast, Map, Navigation, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { MOBILITY_PROFILES, usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SugamPath LPU – Step-Free Routes & Live Lifts at LPU" },
      { name: "description", content: "Choose your mobility profile and get step-free routes, live lift status and instant barrier alerts across LPU campus." },
      { property: "og:title", content: "SugamPath LPU – Step-Free Campus Navigation" },
      { property: "og:description", content: "Step-free routes, live lift status and instant barrier alerts for Lovely Professional University." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const { profile, setProfile, highContrast, setHighContrast } = usePreferences();
  const { user } = useAuth();
  const navigate = useNavigate();

  function onContinue() {
    if (user) void navigate({ to: "/route", search: profile ? { mode: profile } : {} });
    else void navigate({ to: "/auth", search: { tab: "guest" } });
  }

  const quick = [
    { to: "/map", label: "Accessible Map", text: "Step-free paths & live barriers", icon: Map },
    { to: "/route", label: "Find a Route", text: "Slope, steps & lifts checked", icon: Navigation },
    { to: "/lifts", label: "Live Lifts", text: "Status with timestamps", icon: ArrowUpDown },
    { to: "/report", label: "Report Barrier", text: "3-tap quick report", icon: TriangleAlert },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
        <section aria-labelledby="welcome-title" className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="bg-navy px-5 py-4 text-navy-foreground">
            <h1 id="welcome-title" className="text-xl font-bold">Welcome</h1>
            <p className="text-sm text-navy-foreground/80">Profile & Contrast Mode</p>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-2xl bg-secondary p-5">
              <p className="text-2xl font-extrabold text-navy">SugamPath LPU</p>
              <p className="mt-1 text-muted-foreground">Step-free routes, live lift status, and instant barrier alerts.</p>
            </div>

            <fieldset>
              <legend className="font-bold">Select Mobility Profile:</legend>
              <div className="mt-3 space-y-2.5" role="radiogroup" aria-label="Mobility profile">
                {MOBILITY_PROFILES.map((p) => {
                  const on = profile === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setProfile(p.id)}
                      className={cn(
                        "flex min-h-14 w-full flex-col justify-center rounded-xl px-4 py-2 text-left transition-colors",
                        on ? "bg-navy text-navy-foreground shadow-md" : "bg-secondary text-foreground hover:bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2 font-bold">
                        {on && <CheckCircle2 className="size-5" aria-hidden />}
                        {p.label}
                      </span>
                      <span className={cn("text-sm", on ? "text-navy-foreground/80" : "text-muted-foreground")}>{p.help}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Button variant="hero" size="lg" className="w-full" onClick={onContinue}>
              {user ? "Continue to Routes" : "Continue (Guest or Login)"}
            </Button>

            <button
              type="button"
              aria-pressed={highContrast}
              onClick={() => setHighContrast(!highContrast)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-navy px-4 font-bold text-navy hover:bg-secondary"
            >
              <Contrast className="size-5" aria-hidden /> High-Contrast & Large Text: {highContrast ? "ON" : "OFF"}
            </button>
          </div>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="quick-title">
            <h2 id="quick-title" className="text-2xl font-bold">Where do you want to go?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quick.map((q) => (
                <Link key={q.to} to={q.to} className="surface-card group flex items-center gap-4 p-4 hover:border-accent">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-navy text-navy-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                    <q.icon className="size-6" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-lg font-bold">{q.label}</span>
                    <span className="block text-sm text-muted-foreground">{q.text}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="honest" className="surface-card p-5">
            <h2 id="honest" className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="size-6 text-success" aria-hidden /> Honest route information</h2>
            <p className="mt-2 text-muted-foreground">
              Routes use only recorded and verified campus data. Unknown accessibility is never treated as accessible — if no verified route exists, SugamPath tells you so.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {["Ramps trusted only after on-site checks", "Lifts used only when confirmed working", "Old survey data clearly marked", "Blocked paths removed instantly"].map((t) => (
                <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-5 shrink-0 text-success" aria-hidden />{t}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
