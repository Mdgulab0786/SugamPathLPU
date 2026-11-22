import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-card pb-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          <strong className="text-foreground">SugamPath LPU</strong> · Lovely Professional University, Phagwara. Route info comes only from verified campus data. Map © OpenStreetMap contributors.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4 font-semibold">
          <Link to="/about" className="underline underline-offset-4 hover:no-underline">About</Link>
          <Link to="/accessibility" className="underline underline-offset-4 hover:no-underline">Accessibility</Link>
          <Link to="/privacy" className="underline underline-offset-4 hover:no-underline">Privacy</Link>
          <Link to="/track" className="underline underline-offset-4 hover:no-underline">Track report</Link>
        </nav>
      </div>
    </footer>
  );
}
