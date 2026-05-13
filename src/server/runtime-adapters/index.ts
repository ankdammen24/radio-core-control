// Runtime adapter registry. Server-only.
// Add new runtime types here (Icecast, Liquidsoap, Stereo Tool, custom).
import { AzuracastAdapter } from "./azuracast";
import { IcecastAdapter } from "./icecast";
import { LiquidsoapAdapter } from "./liquidsoap";
import { StereoToolAdapter } from "./stereo-tool";
import type { RuntimeAdapter, RuntimeTargetConfig, NormalizedStatus } from "./types";

export type { RuntimeAdapter, RuntimeTargetConfig, NormalizedStatus };

export function buildAdapter(cfg: RuntimeTargetConfig, apiKey: string | null): RuntimeAdapter {
  switch (cfg.type) {
    case "azuracast":
      if (!apiKey) throw new Error(`AzuraCast target ${cfg.name} requires api_key_secret_name with a configured secret`);
      return new AzuracastAdapter(cfg, apiKey);
    case "icecast":
      return new IcecastAdapter(cfg);
    case "liquidsoap":
      return new LiquidsoapAdapter(cfg);
    case "stereo_tool":
      return new StereoToolAdapter(cfg);
    case "custom":
      return new GenericReachabilityAdapter(cfg);
  }
}

/**
 * Fallback adapter for runtime types without a dedicated implementation yet.
 * Performs a simple HTTP HEAD/GET on base_url to determine reachability.
 */
class GenericReachabilityAdapter implements RuntimeAdapter {
  readonly type;
  constructor(private cfg: RuntimeTargetConfig) {
    this.type = cfg.type;
  }
  async testConnection(): Promise<NormalizedStatus> {
    if (!this.cfg.base_url) {
      return { status: "error", reachable: false, message: "No base_url configured" };
    }
    try {
      const res = await fetch(this.cfg.base_url, { method: "GET" });
      const ok = res.ok || res.status === 401 || res.status === 403;
      return {
        status: ok ? "ok" : "degraded",
        reachable: ok,
        message: ok ? `Reachable (HTTP ${res.status})` : `Unexpected HTTP ${res.status}`,
      };
    } catch (e) {
      return { status: "down", reachable: false, message: `Unreachable: ${(e as Error).message}` };
    }
  }
}
