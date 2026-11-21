import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, LogIn, Menu, Route as RouteIcon, X, LayoutDashboard, Settings2, FileText, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/map", label: "Campus map" },
  { to: "/route", label: "Find route" },
  { to: "/lifts", label: "Lifts" },
  { to: "/report", label: "Report a barrier" },
  { to: "/track", label: "Track report" },
] as const;

function useUnreadCount(userId: string | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["me", "unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .is("read_at", null);
      return count ?? 0;
    },
  });
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notif-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["me"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);
  return q.data ?? 0;
}

export function SiteHeader() {
  const { user, isStaff, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(user?.id);

  const linkCls =
    "rounded-lg px-3 py-2 text-base font-semibold text-navy-foreground/90 hover:bg-navy-foreground/10 hover:text-navy-foreground";
  const activeCls = "bg-navy-foreground/15 text-navy-foreground underline decoration-accent decoration-[3px] underline-offset-[6px]";

  return (
    <header className="sticky top-0 z-[1000] bg-navy text-navy-foreground shadow-md">
      <a href="#main" className="skip-link">Skip to main content</a>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg pr-2" aria-label="ClearRoute home">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <RouteIcon className="size-6" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-xl font-bold">ClearRoute</span>
            <span className="hidden text-xs text-navy-foreground/75 sm:block">Accessible Campus Navigation · LPU</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={linkCls} activeProps={{ className: activeCls, "aria-current": "page" }}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/notifications"
                className="relative flex size-11 items-center justify-center rounded-lg hover:bg-navy-foreground/10"
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              >
                <Bell className="size-6" aria-hidden />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 min-w-5 rounded-full bg-accent px-1 text-center text-xs font-bold text-accent-foreground">
                    {unread}
                  </span>
                )}
              </Link>
              <div className="hidden items-center gap-1 md:flex">
                <Link to="/my-reports" className={linkCls}>My reports</Link>
                {isStaff && <Link to="/staff" className={linkCls}>Staff</Link>}
                {isAdmin && <Link to="/admin" className={linkCls}>Admin</Link>}
                <Button variant="onDark" size="sm" onClick={() => void signOut()}>Sign out</Button>
              </div>
            </>
          ) : (
            <Button asChild variant="hero" size="sm" className="hidden md:inline-flex">
              <Link to="/auth"><LogIn aria-hidden /> Sign in</Link>
            </Button>
          )}
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg hover:bg-navy-foreground/10 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-navy-foreground/15 px-4 pb-4 lg:hidden">
          <ul className="flex flex-col gap-1 pt-2">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className={`block ${linkCls}`} activeProps={{ className: activeCls }} onClick={() => setOpen(false)}>
                  {n.label}
                </Link>
              </li>
            ))}
            {user ? (
              <>
                <li><Link to="/my-reports" className={`flex items-center gap-2 ${linkCls}`} onClick={() => setOpen(false)}><FileText className="size-5" aria-hidden />My reports</Link></li>
                {isStaff && <li><Link to="/staff" className={`flex items-center gap-2 ${linkCls}`} onClick={() => setOpen(false)}><LayoutDashboard className="size-5" aria-hidden />Staff dashboard</Link></li>}
                {isAdmin && <li><Link to="/admin" className={`flex items-center gap-2 ${linkCls}`} onClick={() => setOpen(false)}><Settings2 className="size-5" aria-hidden />Map administration</Link></li>}
                <li>
                  <button type="button" className={`flex w-full items-center gap-2 text-left ${linkCls}`} onClick={() => { setOpen(false); void signOut(); }}>
                    <LogOut className="size-5" aria-hidden /> Sign out
                  </button>
                </li>
              </>
            ) : (
              <li><Link to="/auth" className={`block ${linkCls}`} onClick={() => setOpen(false)}>Sign in</Link></li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
