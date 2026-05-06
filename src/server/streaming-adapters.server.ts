// Pluggable streaming output adapters.
// Each adapter knows how to render a Liquidsoap output block, how to probe
// listener stats, and how to compute a public stream URL for one StreamingOutput.

export type StreamingOutputType =
  | "icecast_kh" | "icecast" | "shoutcast" | "hls"
  | "relay" | "srt" | "rtmp" | "webrtc";

export type StreamingOutput = {
  id: string;
  station_id: string;
  type: StreamingOutputType;
  name: string;
  is_enabled: boolean;
  is_public: boolean;
  host: string;
  port: number;
  mountpoint: string | null;
  username: string | null;
  password_secret_name: string | null;
  password: string | null;
  codec: string;
  format: string;
  bitrate: number;
  sample_rate: number;
  channels: number;
  use_tls: boolean;
  proxy_url: string | null;
  listener_stats_url: string | null;
  health_status: "unknown" | "healthy" | "degraded" | "down";
  last_health_at: string | null;
  last_listeners: number | null;
  config: Record<string, any>;
  notes: string | null;
  priority: number;
};

export type StationLite = { id: string; name: string; slug: string };

export type RenderContext = {
  station: StationLite;
  /** Liquidsoap source variable name to attach the output to (e.g. "radio"). */
  sourceVar: string;
};

export type AdapterCapabilities = {
  /** Adapter renders an output.* block in radio.liq. */
  liquidsoap: boolean;
  /** Adapter is realised by an external relay/CDN/proxy and not by Liquidsoap. */
  external: boolean;
};

export type StreamingAdapter = {
  type: StreamingOutputType;
  label: string;
  description: string;
  capabilities: AdapterCapabilities;
  /** Render a Liquidsoap snippet to be inserted at the bottom of radio.liq. */
  renderLiquidsoap: (out: StreamingOutput, ctx: RenderContext) => string;
  /** Public listener URL (best effort). */
  publicUrl: (out: StreamingOutput) => string | null;
  /** Endpoint the runner polls for listener stats; returns null if unsupported. */
  defaultStatsUrl: (out: StreamingOutput) => string | null;
};

// ---------- helpers ----------
const liqEsc = (s: string) => String(s ?? "").replace(/"/g, '\\"');
const proto = (o: StreamingOutput) => (o.use_tls ? "https" : "http");
const mountStr = (o: StreamingOutput) => o.mountpoint ?? "/";

function liqIcecastBlock(o: StreamingOutput, ctx: RenderContext, opts: { protocol: "icecast" | "icy" | "shoutcast" }) {
  const fmt = o.codec === "ogg" || o.codec === "vorbis"
    ? `%vorbis(samplerate=${o.sample_rate}, channels=${o.channels}, quality=0.5)`
    : o.codec === "opus"
      ? `%opus(samplerate=48000, channels=${o.channels}, bitrate=${o.bitrate})`
      : o.codec === "aac"
        ? `%fdkaac(channels=${o.channels}, samplerate=${o.sample_rate}, bitrate=${o.bitrate})`
        : `%mp3(samplerate=${o.sample_rate}, channels=${o.channels}, bitrate=${o.bitrate})`;

  const password = o.password ?? `getenv("OUTPUT_${o.id.replace(/-/g, "_").toUpperCase()}_PASSWORD")`;
  const passwordExpr = o.password ? `"${liqEsc(password)}"` : password;

  return `# [${o.type}] ${liqEsc(o.name)}
output.icecast(
  ${fmt},
  host = "${liqEsc(o.host)}",
  port = ${o.port},
  password = ${passwordExpr},
  mount = "${liqEsc(mountStr(o))}",
  name = "${liqEsc(ctx.station.name)} — ${liqEsc(o.name)}",
  protocol = "${opts.protocol}",
  public = ${o.is_public ? "true" : "false"},
  fallible = true,
  ${ctx.sourceVar}
)`;
}

// ---------- adapters ----------
const icecastBase = (label: string, type: StreamingOutputType, description: string): StreamingAdapter => ({
  type,
  label,
  description,
  capabilities: { liquidsoap: true, external: false },
  renderLiquidsoap: (o, ctx) => liqIcecastBlock(o, ctx, { protocol: "icecast" }),
  publicUrl: (o) => `${proto(o)}://${o.host}:${o.port}${mountStr(o)}`,
  defaultStatsUrl: (o) => `${proto(o)}://${o.host}:${o.port}/status-json.xsl`,
});

const adapters: Record<StreamingOutputType, StreamingAdapter> = {
  icecast_kh: icecastBase(
    "Icecast-KH",
    "icecast_kh",
    "Karl Heyes' Icecast fork. Default reference implementation.",
  ),
  icecast: icecastBase(
    "Icecast (vanilla)",
    "icecast",
    "Upstream Icecast 2.x server.",
  ),
  shoutcast: {
    type: "shoutcast",
    label: "SHOUTcast",
    description: "Legacy SHOUTcast v1/v2 server.",
    capabilities: { liquidsoap: true, external: false },
    renderLiquidsoap: (o, ctx) => liqIcecastBlock(o, ctx, { protocol: "icy" }),
    publicUrl: (o) => `${proto(o)}://${o.host}:${o.port}/;`,
    defaultStatsUrl: (o) => `${proto(o)}://${o.host}:${o.port}/statistics?json=1`,
  },
  hls: {
    type: "hls",
    label: "HLS",
    description: "HTTP Live Streaming via Liquidsoap output.file.hls.",
    capabilities: { liquidsoap: true, external: false },
    renderLiquidsoap: (o, ctx) => {
      const dir = o.config?.output_dir ?? `/var/lib/liquidsoap/hls/${ctx.station.slug}/${o.name}`;
      const segments = o.config?.segments ?? 5;
      const duration = o.config?.segment_duration ?? 4;
      return `# [hls] ${liqEsc(o.name)}
output.file.hls(
  playlist = "stream.m3u8",
  segment_duration = ${duration}.0,
  segments = ${segments},
  segments_overhead = 5,
  persist_at = "${liqEsc(dir)}/state.config",
  "${liqEsc(dir)}",
  [("aac", %fdkaac(channels=${o.channels}, samplerate=${o.sample_rate}, bitrate=${o.bitrate}))],
  ${ctx.sourceVar}
)`;
    },
    publicUrl: (o) => o.config?.public_base_url
      ? `${o.config.public_base_url.replace(/\/$/, "")}/${o.config?.output_dir ? "" : ""}stream.m3u8`
      : null,
    defaultStatsUrl: () => null,
  },
  relay: {
    type: "relay",
    label: "External Relay / CDN",
    description: "Upstream relay or CDN edge — no Liquidsoap output, configured externally.",
    capabilities: { liquidsoap: false, external: true },
    renderLiquidsoap: (o) => `# [relay] ${liqEsc(o.name)} — external relay, no Liquidsoap output emitted`,
    publicUrl: (o) => o.proxy_url ?? `${proto(o)}://${o.host}:${o.port}${mountStr(o)}`,
    defaultStatsUrl: (o) => o.listener_stats_url,
  },
  srt: {
    type: "srt",
    label: "SRT (preview)",
    description: "Secure Reliable Transport — requires Liquidsoap built with SRT support.",
    capabilities: { liquidsoap: true, external: false },
    renderLiquidsoap: (o, ctx) => `# [srt] ${liqEsc(o.name)} — preview adapter
# Requires Liquidsoap compiled with SRT
output.srt(
  host = "${liqEsc(o.host)}",
  port = ${o.port},
  %mp3(samplerate=${o.sample_rate}, channels=${o.channels}, bitrate=${o.bitrate}),
  ${ctx.sourceVar}
)`,
    publicUrl: (o) => `srt://${o.host}:${o.port}`,
    defaultStatsUrl: () => null,
  },
  rtmp: {
    type: "rtmp",
    label: "RTMP (preview)",
    description: "Push to RTMP ingest (e.g. YouTube/Twitch). Requires ffmpeg sidecar.",
    capabilities: { liquidsoap: false, external: true },
    renderLiquidsoap: (o) => `# [rtmp] ${liqEsc(o.name)} — handled by ffmpeg sidecar, not Liquidsoap`,
    publicUrl: (o) => `rtmp://${o.host}:${o.port}${mountStr(o)}`,
    defaultStatsUrl: () => null,
  },
  webrtc: {
    type: "webrtc",
    label: "WebRTC (preview)",
    description: "Low-latency WebRTC delivery via external SFU (e.g. MediaMTX, Janus).",
    capabilities: { liquidsoap: false, external: true },
    renderLiquidsoap: (o) => `# [webrtc] ${liqEsc(o.name)} — handled by external SFU`,
    publicUrl: (o) => o.proxy_url ?? null,
    defaultStatsUrl: (o) => o.listener_stats_url,
  },
};

export function getAdapter(type: StreamingOutputType): StreamingAdapter {
  return adapters[type] ?? adapters.icecast_kh;
}

export function listAdapters(): StreamingAdapter[] {
  return Object.values(adapters);
}

/** Render the streaming outputs section appended at end of radio.liq. */
export function renderOutputsLiq(outs: StreamingOutput[], ctx: RenderContext): string {
  const enabled = outs.filter((o) => o.is_enabled);
  if (enabled.length === 0) return "# No streaming outputs configured.\n";
  return enabled
    .sort((a, b) => a.priority - b.priority)
    .map((o) => getAdapter(o.type).renderLiquidsoap(o, ctx))
    .join("\n\n") + "\n";
}
