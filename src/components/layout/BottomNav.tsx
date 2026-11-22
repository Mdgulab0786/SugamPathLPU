import { Link } from "@tanstack/react-router";
import { ArrowUpDown, Map, Navigation, TriangleAlert } from "lucide-react";

const TABS = [
  { to: "/map", label: "Map", icon: Map },
  { to: "/route", label: "Routes", icon: Navigation },
  { to: "/lifts", label: "Lifts", icon: ArrowUpDown },
  { to: "/report", label: "Report", icon: TriangleAlert },
] as const;

/** App-style bottom tab bar, always visible. */
export function BottomNav() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-card shadow-[0_-4px_16px_-8px_color-mix(in_oklab,var(--navy)_30%,transparent)]">
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map((t) => (
          <li key={t.to}>
            <Link
              to={t.to}
              className="flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
              activeProps={{ className: "!text-accent", "aria-current": "page" }}
            >
              <t.icon className="size-6" aria-hidden />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
