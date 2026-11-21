import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { GraduationCap, HardHat, UserRound, Mail } from "lucide-react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { ErrorBlock } from "@/components/common/PageHeader";

const searchSchema = z.object({ redirect: z.string().optional(), tab: z.enum(["guest", "student", "staff"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in – ClearRoute" },
      { name: "description", content: "Continue as a guest, or sign in as an LPU student or campus staff member to use ClearRoute." },
      { property: "og:title", content: "Sign in – ClearRoute" },
      { property: "og:description", content: "Guest, student and staff access to ClearRoute accessible campus navigation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safeRedirect(r: string | undefined) {
  if (!r) return null;
  try {
    const u = new URL(r, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}

const GoogleLogo = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, isStaff, canManageLifts, loading } = useAuth();
  const [tab, setTab] = useState<"guest" | "student" | "staff">(search.tab ?? "student");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (!user || loading) return;
    const dest = safeRedirect(search.redirect);
    if (dest) {
      window.location.assign(dest);
      return;
    }
    if (tab === "staff") {
      if (isStaff) void navigate({ to: "/staff" });
      else if (canManageLifts) void navigate({ to: "/lifts" });
      else setError("Signed in, but this account does not have a staff role yet. An Administrator must assign it.");
      return;
    }
    void navigate({ to: "/my-reports" });
  }, [user, loading, isStaff, canManageLifts, tab, search.redirect, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const emailOk = z.string().email().safeParse(email.trim());
    if (!emailOk.success) { setError("Please enter a valid email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    if (mode === "signup") {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + "/auth", data: { display_name: name.trim() || undefined } },
      });
      setBusy(false);
      if (err) { setError(err.message); return; }
      if (!data.session) setCheckEmail(true);
      return;
    }
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(err.message === "Invalid login credentials" ? "Email or password is incorrect." : err.message);
    else toast.success("Signed in");
  }

  async function social(provider: "google" | "lovable") {
    setError(null);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) setError(result.error.message ?? "Sign-in failed. Please try again.");
  }

  const tabs = [
    { id: "guest" as const, label: "Continue as Guest", icon: UserRound },
    { id: "student" as const, label: "Student Login", icon: GraduationCap },
    { id: "staff" as const, label: "Staff Login", icon: HardHat },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold md:text-4xl">Access ClearRoute</h1>
      <p className="mt-2 text-lg text-muted-foreground">Choose how you'd like to continue. Guests can find routes and see public accessibility information.</p>

      <div role="tablist" aria-label="Access type" className="mt-6 grid gap-2 sm:grid-cols-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => { setTab(t.id); setError(null); }}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-4 text-base font-bold transition-colors ${
              tab === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"
            }`}
          >
            <t.icon className="size-5" aria-hidden /> {t.label}
          </button>
        ))}
      </div>

      <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="surface-card mt-4 p-6 md:p-8">
        {tab === "guest" ? (
          <div>
            <h2 className="text-2xl font-bold">Continue as a guest</h2>
            <p className="mt-2 text-muted-foreground">
              No account needed to find routes, view the campus map, check lifts or submit an anonymous report. Sign in later to track your reports in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/route">Find a route</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/map">Explore the map</Link></Button>
            </div>
          </div>
        ) : checkEmail ? (
          <div role="status">
            <Mail className="size-10 text-primary" aria-hidden />
            <h2 className="mt-3 text-2xl font-bold">Check your email</h2>
            <p className="mt-2 text-muted-foreground">We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account, then sign in.</p>
            <Button className="mt-4" variant="outline" onClick={() => { setCheckEmail(false); setMode("signin"); }}>Back to sign in</Button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold">
              {tab === "staff" ? "Staff sign in" : mode === "signin" ? "Student sign in" : "Create a student account"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              {tab === "staff"
                ? "Estate staff, lift operators and administrators sign in here. Staff roles are assigned by an Administrator."
                : "Students can submit reports and track them. We only ask for what's needed — no medical details."}
            </p>
            {error && <div className="mt-4"><ErrorBlock message={error} /></div>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" size="lg" onClick={() => void social("google")}><GoogleLogo /> Continue with Google</Button>
              <Button type="button" variant="outline" size="lg" onClick={() => void social("lovable")}><LovableMark className="size-[18px]" /> Continue with Lovable</Button>
            </div>
            <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {mode === "signup" && tab === "student" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-base">Display name (optional)</Label>
                  <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" maxLength={80} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-base">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-base">Password</Label>
                <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-help" className="h-12 text-base" />
                <p id="pw-help" className="text-sm text-muted-foreground">At least 8 characters.</p>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
            {tab === "student" && (
              <p className="mt-4 text-center">
                {mode === "signin" ? "New to ClearRoute? " : "Already have an account? "}
                <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}>
                  {mode === "signin" ? "Create a student account" : "Sign in"}
                </button>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
