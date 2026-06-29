/**
 * @legacy AzuraCast runtime adapter (server-only)
 *
 * STATUS: Do not extend. Only handles type:'azuracast' runtime_targets rows.
 * PLAN:   Remove when existing azuracast_connections and runtime_targets of type
 *         'azuracast' are cleaned from the database.
 * SEE:    docs/architecture/radio-core-v2.md §3 — AzuraCast phase-out plan
 */
// AzuraCast runtime adapter. Server-only.
import { AzuracastClient, AzuracastError } from "@/server/azuracast-client.server";
import type {
  RuntimeAdapter,
  RuntimeTargetConfig,
  NormalizedStatus,
  NormalizedNowPlaying,
} from "./types";

export class AzuracastAdapter implements RuntimeAdapter {
  readonly type = "azuracast" as const;
  private client: AzuracastClient;

  constructor(private cfg: RuntimeTargetConfig, apiKey: string) {
    if (!cfg.base_url) throw new Error("AzuraCast target missing base_url");
    if (!cfg.external_station_id) throw new Error("AzuraCast target missing external_station_id");
    this.client = new AzuracastClient({
      baseUrl: cfg.base_url,
      apiKey,
      stationId: cfg.external_station_id,
    });
  }

  async testConnection(): Promise<NormalizedStatus> {
    try {
      const np = await this.client.nowPlaying().catch(() => null);
      const normalized = np ? normalizeNowPlaying(np) : null;
      return {
        status: "ok",
        reachable: true,
        message: "AzuraCast reachable",
        nowPlaying: normalized,
        serverInfo: typeof np === "object" && np ? { stationName: (np as any)?.station?.name ?? null } : null,
        raw: np,
      };
    } catch (e) {
      const err = e instanceof AzuracastError ? `HTTP ${e.status}` : (e as Error).message;
      return {
        status: "down",
        reachable: false,
        message: `AzuraCast unreachable: ${err}`,
        raw: e instanceof AzuracastError ? e.body : null,
      };
    }
  }

  async fetchNowPlaying(): Promise<NormalizedNowPlaying | null> {
    const np = await this.client.nowPlaying().catch(() => null);
    return np ? normalizeNowPlaying(np) : null;
  }
}

function normalizeNowPlaying(np: unknown): NormalizedNowPlaying {
  const r = (np ?? {}) as any;
  const song = r?.now_playing?.song ?? {};
  return {
    title: song.title ?? null,
    artist: song.artist ?? null,
    album: song.album ?? null,
    artworkUrl: song.art ?? null,
    startedAt: r?.now_playing?.played_at
      ? new Date(r.now_playing.played_at * 1000).toISOString()
      : null,
    durationSeconds: r?.now_playing?.duration ?? null,
    listeners: r?.listeners?.current ?? null,
  };
}
