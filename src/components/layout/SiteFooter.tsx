import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="text-xl font-bold">ClearRoute</p>
          <p className="mt-2 max-w-md text-navy-foreground/80">
            Every journey should have a barrier-free path. Route information comes only from recorded and verified campus data —
            unknown accessibility is never shown as accessible.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="font-bold">About</p>
          <ul className="mt-2 space-y-1.5">
            <li><Link to="/about" className="underline underline-offset-4 hover:no-underline">About ClearRoute</Link></li>
            <li><Link to="/accessibility" className="underline underline-offset-4 hover:no-underline">Accessibility statement</Link></li>
            <li><Link to="/privacy" className="underline underline-offset-4 hover:no-underline">Privacy policy</Link></li>
          </ul>
        </nav>
        <div>
          <p className="font-bold">Campus support</p>
          <p className="mt-2 text-navy-foreground/80">
            For urgent help on campus, contact LPU's official estate or security office through the university's published channels.
            ClearRoute does not list helpline numbers it cannot verify.
          </p>
          <Link to="/report" className="mt-2 inline-block font-semibold underline underline-offset-4 hover:no-underline">Report a barrier</Link>
        </div>
      </div>
      <div className="border-t border-navy-foreground/15 py-4 text-center text-sm text-navy-foreground/70">
        ClearRoute for Lovely Professional University, Phagwara, Punjab. Map data © OpenStreetMap contributors.
      </div>
    </footer>
  );
}
