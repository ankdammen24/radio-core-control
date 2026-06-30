import { listStations as listApiStations, getStation as getApiStation, type ApiStation } from "@/services/stationsApi";
import type { SourcedResult } from "@/services/data-source";

export interface Station {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  logo_url: string | null;
  /** Not modeled by the Radio Core API yet — always null until added to the backend. */
  accent_color: string | null;
  /** Not modeled by the Radio Core API yet — always null until added to the backend. */
  slogan: string | null;
  /** Not modeled by the Radio Core API yet — always null until added to the backend. */
  public_url: string | null;
}

function fromApi(station: ApiStation): Station {
  return {
    id: station.id,
    name: station.name,
    slug: station.slug,
    description: station.description ?? null,
    is_active: station.isActive,
    logo_url: station.demoArtworkUrl ?? null,
    accent_color: null,
    slogan: null,
    public_url: null,
  };
}

export async function listStations(): Promise<SourcedResult<Station[]>> {
  try {
    const stations = await listApiStations();
    return { data: stations.map(fromApi), source: "radio-core", fallback: false };
  } catch (error) {
    return {
      data: [],
      source: "none",
      fallback: false,
      fallbackReason: error instanceof Error ? error.message : "Radio Core Backend is unavailable",
    };
  }
}

export async function getStation(id: string): Promise<SourcedResult<Station | null>> {
  try {
    const station = await getApiStation(id);
    return { data: fromApi(station), source: "radio-core", fallback: false };
  } catch (error) {
    return {
      data: null,
      source: "none",
      fallback: false,
      fallbackReason: error instanceof Error ? error.message : "Radio Core Backend is unavailable",
    };
  }
}
