// Icecast runtime adapter. Server-only.
// Uses the standard /status-json.xsl endpoint exposed by Icecast/Icecast-kh.
import type {
  RuntimeAdapter,
  RuntimeTargetConfig,
  NormalizedStatus,
  NormalizedNowPlaying,
} from "./types";

interface IcecastSource {
  listenurl?: string;
  server_name?: string;
  server_description?: string;
  listeners?: number;
  listener_peak?: number;
  title?: string;
  artist?: string;
  bitrate?: number;
  server_type?: string;
}

interface IcecastStatus {
  icestats?: {
    server_id?: string;
    host?: string;
    location?: string;
    admin?: string;
    source?: IcecastSource | IcecastSource[];
  };
}

export class IcecastAdapter implements RuntimeAdapter {
  readonly type = "icecast" as const;

  constructor(private cfg: RuntimeTargetConfig) {
    if (!cfg.base_url) throw new Error("Icecast target missing base_url");
  }

  private statusUrl(): string {
    const base = this.cfg.base_url!.replace(/\/+$/, "");
    return `${base}/status-json.xsl`;
  }

  private firstSource(stats: IcecastStatus): IcecastSource | null {
    const src = stats?.icestats?.source;
    if (!src) return null;
    if (Array.isArray(src)) {
      const mountPath = (this.cfg.metadata?.mount_path as string | undefined) ?? null;
      if (mountPath) {
        const match = src.find((s) => s.listenurl?.endsWith(mountPath));
        if (match) return match;
      }
      return src[0] ?? null;
    }
    return src;
  }

  async testConnection(): Promise<NormalizedStatus> {
    try {
      const res = await fetch(this.statusUrl(), { method: "GET" });
      if (!res.ok) {
        return {
          status: "degraded",
          reachable: true,
          message: `Icecast responded with HTTP ${res.status}`,
        };
      }
      const stats = (await res.json()) as IcecastStatus;
      const src = this.firstSource(stats);
      const totalListeners = Array.isArray(stats.icestats?.source)
        ? stats.icestats!.source.reduce((a, s) => a + (s.listeners ?? 0), 0)
        : src?.listeners ?? 0;
      return {
        status: "ok",
        reachable: true,
        message: `Icecast reachable (${Array.isArray(stats.icestats?.source) ? stats.icestats!.source.length : src ? 1 : 0} sources, ${totalListeners} listeners)`,
        nowPlaying: src ? this.normalize(src) : null,
        serverInfo: {
          host: stats.icestats?.host ?? null,
          server_id: stats.icestats?.server_id ?? null,
          location: stats.icestats?.location ?? null,
          totalListeners,
        },
      };
    } catch (e) {
      return {
        status: "down",
        reachable: false,
        message: `Icecast unreachable: ${(e as Error).message}`,
      };
    }
  }

  async fetchNowPlaying(): Promise<NormalizedNowPlaying | null> {
    try {
      const res = await fetch(this.statusUrl());
      if (!res.ok) return null;
      const stats = (await res.json()) as IcecastStatus;
      const src = this.firstSource(stats);
      return src ? this.normalize(src) : null;
    } catch {
      return null;
    }
  }

  private normalize(src: IcecastSource): NormalizedNowPlaying {
    return {
      title: src.title ?? null,
      artist: src.artist ?? null,
      album: null,
      artworkUrl: null,
      startedAt: null,
      durationSeconds: null,
      listeners: src.listeners ?? null,
    };
  }
}
