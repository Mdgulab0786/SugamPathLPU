import { lazy, Suspense, useEffect, useState } from "react";
import type { CampusMapProps } from "./CampusMap";

const CampusMap = lazy(() => import("./CampusMap"));

/** Client-only wrapper: Leaflet touches window at import time. */
export function MapView(props: CampusMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fallback = (
    <div className={props.className}>
      <div role="status" className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
        Loading map…
      </div>
    </div>
  );
  if (!mounted) return fallback;
  return (
    <Suspense fallback={fallback}>
      <CampusMap {...props} />
    </Suspense>
  );
}

export type { CampusMapProps };
