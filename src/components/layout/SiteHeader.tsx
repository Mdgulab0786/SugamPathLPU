import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, LogIn, Menu, Route as RouteIcon, X, LayoutDashboard, Settings2, FileText, LogOut, Search, Info, Contrast } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePreferences } from "@/lib/preferences";
import { supabase } from "@/integrations/supabase/client";

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

/** Compact navy app bar. Primary navigation lives in the bottom tab bar. */
export function SiteHeader() {
  const { user, isStaff, isAdmin, signOut } = useAuth();
  const { highContrast, setHighContrast } = usePreferences();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(user?.id);

  const itemCls = "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold hover:bg-navy-foreground/10";
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-[1001] bg-navy text-navy-foreground shadow-md">
      <a href="#main" className="skip-link">Skip to main content</a>
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg pr-2" aria-label="SugamPath LPU home">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <RouteIcon className="size-6" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold">SugamPath LPU</span>
            <span className="block text-xs text-navy-foreground/75">Step-free routes · Live lifts · Barrier alerts</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {user && isStaff && (
            <Link to="/staff" className="hidden min-h-11 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-navy-foreground/10 md:flex" activeProps={{ className: "bg-navy-foreground/15" }}>
              <LayoutDashboard className="size-5" aria-hidden /> Estate
            </Link>
          )}
          {user ? (
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
          ) : (
            <Link to="/auth" className="hidden min-h-10 items-center gap-2 rounded-lg bg-accent px-4 font-bold text-accent-foreground hover:bg-accent/90 sm:flex">
              <LogIn className="size-5" aria-hidden /> Sign in
            </Link>
          )}
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg hover:bg-navy-foreground/10"
            aria-expanded={open}
            aria-controls="app-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="app-menu" aria-label="More" className="border-t border-navy-foreground/15">
          <ul className="mx-auto grid max-w-6xl gap-1 px-4 py-3 sm:grid-cols-2 md:grid-cols-3">
            <li><Link to="/track" className={itemCls} onClick={close}><Search className="size-5" aria-hidden />Track a report</Link></li>
            <li>
              <button type="button" className={itemCls} aria-pressed={highContrast} onClick={() => setHighContrast(!highContrast)}>
                <Contrast className="size-5" aria-hidden /> High-contrast & large text: {highContrast ? "ON" : "OFF"}
              </button>
            </li>
            <li><Link to="/about" className={itemCls} onClick={close}><Info className="size-5" aria-hidden />About & verification</Link></li>
            {user ? (
              <>
                <li><Link to="/my-reports" className={itemCls} onClick={close}><FileText className="size-5" aria-hidden />My reports</Link></li>
                {isStaff && <li><Link to="/staff" className={itemCls} onClick={close}><LayoutDashboard className="size-5" aria-hidden />Estate dashboard</Link></li>}
                {isAdmin && <li><Link to="/admin" className={itemCls} onClick={close}><Settings2 className="size-5" aria-hidden />Map administration</Link></li>}
                <li>
                  <button type="button" className={itemCls} onClick={() => { close(); void signOut(); }}>
                    <LogOut className="size-5" aria-hidden /> Sign out
                  </button>
                </li>
              </>
            ) : (
              <li><Link to="/auth" className={itemCls} onClick={close}><LogIn className="size-5" aria-hidden />Sign in</Link></li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
