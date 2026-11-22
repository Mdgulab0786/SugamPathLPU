import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { MobilityMode } from "@/lib/routing/types";

/** The three profiles offered on the welcome screen, mapped onto routing modes. */
export const MOBILITY_PROFILES: { id: MobilityMode; label: string; help: string }[] = [
  { id: "wheelchair", label: "Wheelchair (Zero Steps)", help: "Never uses steps, kerbs or unconfirmed lifts" },
  { id: "walking_aid", label: "Crutches / Temporary Injury", help: "Gentle slopes, short distances, ramps preferred" },
  { id: "avoid_stairs", label: "Heavy Luggage / Cart", help: "Avoids stairs and steps" },
];

interface Prefs {
  profile: MobilityMode | null;
  setProfile: (m: MobilityMode) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
}

const Ctx = createContext<Prefs | null>(null);
const PROFILE_KEY = "sugampath-profile";
const HC_KEY = "sugampath-high-contrast";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<MobilityMode | null>(null);
  const [highContrast, setHc] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem(PROFILE_KEY);
    if (p) setProfileState(p as MobilityMode);
    setHc(localStorage.getItem(HC_KEY) === "1");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("hc", highContrast);
  }, [highContrast]);

  const setProfile = useCallback((m: MobilityMode) => {
    setProfileState(m);
    localStorage.setItem(PROFILE_KEY, m);
  }, []);
  const setHighContrast = useCallback((v: boolean) => {
    setHc(v);
    localStorage.setItem(HC_KEY, v ? "1" : "0");
  }, []);

  return <Ctx.Provider value={{ profile, setProfile, highContrast, setHighContrast }}>{children}</Ctx.Provider>;
}

export function usePreferences() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePreferences must be used inside PreferencesProvider");
  return v;
}
