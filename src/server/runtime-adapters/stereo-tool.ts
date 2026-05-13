// Stereo Tool runtime adapter. Server-only.
// Stereo Tool runs as a binary on the broadcast host and is controlled via
// the Radio Core Agent (see docs/agents.md). This adapter is a stub so the
// runtime target can be registered and surfaced in the UI before the agent
// is online.
import type {
  RuntimeAdapter,
  RuntimeTargetConfig,
  NormalizedStatus,
  NormalizedNowPlaying,
} from "./types";

export class StereoToolAdapter implements RuntimeAdapter {
  readonly type = "stereo_tool" as const;

  constructor(private cfg: RuntimeTargetConfig) {}

  async testConnection(): Promise<NormalizedStatus> {
    const httpUrl = (this.cfg.metadata?.http_url as string | undefined) ?? null;
    if (httpUrl) {
      try {
        const res = await fetch(httpUrl, { method: "GET" });
        const ok = res.ok || res.status === 401 || res.status === 403;
        return {
          status: ok ? "ok" : "degraded",
          reachable: ok,
          message: ok
            ? `Stereo Tool web UI reachable (HTTP ${res.status})`
            : `HTTP ${res.status}`,
          serverInfo: { mode: "http-probe" },
        };
      } catch (e) {
        return {
          status: "down",
          reachable: false,
          message: `Stereo Tool unreachable: ${(e as Error).message}`,
        };
      }
    }
    return {
      status: "unknown",
      reachable: false,
      message:
        "Stereo Tool stub adapter — pair with a Radio Core Agent for live control, or set metadata.http_url for a basic probe.",
      serverInfo: { mode: "stub" },
    };
  }

  async fetchNowPlaying(): Promise<NormalizedNowPlaying | null> {
    return null;
  }
}
