/**
 * Station context — single source of truth for the active station scope.
 *
 * White-label ready: components read station name/slug/accent/logo/slogan/url
 * from this context, never from hardcoded copy. Schema currently exposes
 * name/slug/description; brand fields (logo_url, accent_color, slogan,
 * public_url) are optional and read defensively so future schema additions
 * Just Work without UI changes.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { database } from "@/services/database";

export type StationBrand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  logoUrl?: string | null;
  accentColor?: string | null;
  slogan?: string | null;
  publicUrl?: string | null;
  accountName?: string | null;
};

export type StationScope =
  | { kind: "station"; station: StationBrand }
  | { kind: "all" }
  | { kind: "none" };

type Ctx = {
  scope: StationScope;
  stations: StationBrand[];
  loading: boolean;
  setActiveStationId: (id: string | "all") => void;
};

const StationCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "rc.activeStationId";

export function StationProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | "all" | null>(() => {
    if (typeof window === "undefined") return null;
    return (window.localStorage.getItem(STORAGE_KEY) as string | null) ?? null;
  });

  const { data, isLoading } = useQuery({
    queryKey: ["station-context"],
    queryFn: async () => {
      const { data } = await database
        .from("stations")
        .select("id,name,slug,description,is_active, accounts(name)")
        .order("name");
      return (data ?? []).map((s): StationBrand => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        isActive: s.is_active,
        accountName: (s as { accounts?: { name?: string } | null }).accounts?.name ?? null,
      }));
    },
  });

  const stations = data ?? [];

  // Default to first active station once loaded, if none selected.
  useEffect(() => {
    if (activeId || isLoading || stations.length === 0) return;
    const first = stations.find((s) => s.isActive) ?? stations[0];
    if (first) setActiveId(first.id);
  }, [activeId, isLoading, stations]);

  const setActiveStationId = (id: string | "all") => {
    setActiveId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  };

  const scope: StationScope = useMemo(() => {
    if (activeId === "all") return { kind: "all" };
    const found = stations.find((s) => s.id === activeId);
    if (found) return { kind: "station", station: found };
    return { kind: "none" };
  }, [activeId, stations]);

  return (
    <StationCtx.Provider value={{ scope, stations, loading: isLoading, setActiveStationId }}>
      {children}
    </StationCtx.Provider>
  );
}

export function useStationScope() {
  const ctx = useContext(StationCtx);
  if (!ctx) throw new Error("useStationScope must be used inside <StationProvider>");
  return ctx;
}

/** Returns the current station or null when scope is "all"/"none". */
export function useActiveStation(): StationBrand | null {
  const { scope } = useStationScope();
  return scope.kind === "station" ? scope.station : null;
}
