// Liquidsoap runtime adapter. Server-only.
// Liquidsoap exposes a telnet/HTTP control surface; full integration belongs
// to the Node.js Radio Core Agent (see docs/agents.md). This adapter is a
// stub that performs a best-effort HTTP probe when metadata.http_url is set.
import type {
  RuntimeAdapter,
  RuntimeTargetConfig,
  NormalizedStatus,
  NormalizedNowPlaying,
} from "./types";

export class LiquidsoapAdapter implements RuntimeAdapter {
  readonly type = "liquidsoap" as const;

  constructor(private cfg: RuntimeTargetConfig) {}

  async testConnection(): Promise<NormalizedStatus> {
    const httpUrl =
      (this.cfg.metadata?.http_url as string | undefined) ??
      this.cfg.base_url ??
      null;

    if (!httpUrl) {
      return {
        status: "unknown",
        reachable: false,
        message:
          "Liquidsoap stub adapter — configure metadata.http_url or base_url, or pair with a Radio Core Agent for full control.",
        serverInfo: { mode: "stub" },
      };
    }

    try {
      const res = await fetch(httpUrl, { method: "GET" });
      const ok = res.ok || res.status === 401 || res.status === 403;
      return {
        status: ok ? "ok" : "degraded",
        reachable: ok,
        message: ok
          ? `Liquidsoap reachable (HTTP ${res.status})`
          : `Unexpected HTTP ${res.status}`,
        serverInfo: { mode: "http-probe" },
      };
    } catch (e) {
      return {
        status: "down",
        reachable: false,
        message: `Liquidsoap unreachable: ${(e as Error).message}`,
      };
    }
  }

  async fetchNowPlaying(): Promise<NormalizedNowPlaying | null> {
    return null;
  }
}
