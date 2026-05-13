// Shared types and contract for Radio Core runtime adapters.
// Every runtime target type (AzuraCast, Icecast, Liquidsoap, Stereo Tool, custom)
// implements this contract. Keep adapters small + replaceable.

export type RuntimeTargetType =
  | "azuracast"
  | "icecast"
  | "liquidsoap"
  | "stereo_tool"
  | "custom";

export type RuntimeStatus = "unknown" | "ok" | "degraded" | "down" | "error";

export interface RuntimeTargetConfig {
  id: string;
  station_id: string;
  type: RuntimeTargetType;
  name: string;
  base_url: string | null;
  api_key_secret_name: string | null;
  external_station_id: string | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedNowPlaying {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  artworkUrl?: string | null;
  startedAt?: string | null;
  durationSeconds?: number | null;
  listeners?: number | null;
}

export interface NormalizedStatus {
  status: RuntimeStatus;
  reachable: boolean;
  message: string;
  serverInfo?: Record<string, unknown> | null;
  nowPlaying?: NormalizedNowPlaying | null;
  raw?: unknown;
}

export interface RuntimeAdapter {
  type: RuntimeTargetType;
  /** Test that the target is reachable & credentials are valid. */
  testConnection(): Promise<NormalizedStatus>;
  /** Fetch current now-playing if the target supports it. */
  fetchNowPlaying?(): Promise<NormalizedNowPlaying | null>;
}
