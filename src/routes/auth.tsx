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
import { usePreferences } from "@/lib/preferences";

const searchSchema = z.object({ redirect: z.string().optional(), tab: z.enum(["guest", "student", "staff"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in – SugamPath LPU" },
      { name: "description", content: "Continue as a guest, or sign in as an LPU student or campus staff member to use SugamPath LPU." },
      { property: "og:title", content: "Sign in – SugamPath LPU" },
      { property: "og:description", content: "Guest, student and staff access to SugamPath LPU accessible campus navigation." },
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

  const { profile } = usePreferences();
  const formTab: "student" | "staff" = tab === "staff" ? "staff" : "student";
  const tabs = [
    { id: "student" as const, label: "Student", icon: GraduationCap },
    { id: "staff" as const, label: "Staff", icon: HardHat },
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10">
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="bg-navy px-5 py-4 text-navy-foreground">
          <h1 className="text-xl font-bold">Guest & Login</h1>
          <p className="text-sm text-navy-foreground/80">Zero-Friction Access</p>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-xl border-2 border-accent/60 bg-accent/10 p-4">
            <p className="flex items-center gap-2 font-bold text-accent"><UserRound className="size-5" aria-hidden /> Instant Guest Access</p>
            <p className="mt-1 text-sm text-muted-foreground">No login needed to view routes, the map & lifts, or to send an anonymous report.</p>
          </div>
          <Button asChild variant="hero" size="lg" className="w-full">
            <Link to="/route" search={profile ? { mode: profile } : {}}>Continue as Guest</Link>
          </Button>

          <div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" />or sign in<span className="h-px flex-1 bg-border" /></div>

          {checkEmail ? (
            <div role="status">
              <Mail className="size-10 text-primary" aria-hidden />
              <h2 className="mt-3 text-2xl font-bold">Check your email</h2>
              <p className="mt-2 text-muted-foreground">We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account, then sign in.</p>
              <Button className="mt-4" variant="outline" onClick={() => { setCheckEmail(false); setMode("signin"); }}>Back to sign in</Button>
            </div>
          ) : (
            <div>
              <h2 className="font-bold">University account (for Reporting / Staff)</h2>
              <div role="tablist" aria-label="Account type" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    id={`tab-${t.id}`}
                    aria-selected={formTab === t.id}
                    aria-controls="panel-signin"
                    onClick={() => { setTab(t.id); setError(null); if (t.id === "staff") setMode("signin"); }}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-base font-bold transition-colors ${
                      formTab === t.id ? "bg-navy text-navy-foreground shadow" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <t.icon className="size-5" aria-hidden /> {t.label}
                  </button>
                ))}
              </div>
              <div id="panel-signin" role="tabpanel" aria-labelledby={`tab-${formTab}`} className="mt-4">
                <p className="text-sm text-muted-foreground">
                  {formTab === "staff"
                    ? "Estate staff, lift operators and administrators. Staff roles are assigned by an Administrator."
                    : mode === "signin" ? "Sign in to track your reports and get status updates. No medical details needed." : "Create a student account to track your reports."}
                </p>
                {error && <div className="mt-4"><ErrorBlock message={error} /></div>}
                <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
                  {mode === "signup" && formTab === "student" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-base">Display name (optional)</Label>
                      <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-secondary text-base" maxLength={80} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-base">University email</Label>
                    <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@lpu.in" className="h-12 bg-secondary text-base" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-base">Password</Label>
                    <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-help" className="h-12 bg-secondary text-base" />
                    <p id="pw-help" className="text-sm text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <Button type="submit" variant="navy" size="lg" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : mode === "signin" ? (formTab === "staff" ? "Staff sign in" : "Sign in") : "Create account"}
                  </Button>
                </form>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={() => void social("google")}><GoogleLogo /> Google</Button>
                  <Button type="button" variant="outline" onClick={() => void social("lovable")}><LovableMark className="size-[18px]" /> Lovable</Button>
                </div>
                {formTab === "student" && (
                  <p className="mt-4 text-center">
                    {mode === "signin" ? "New to SugamPath? " : "Already have an account? "}
                    <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}>
                      {mode === "signin" ? "Create a student account" : "Sign in"}
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
