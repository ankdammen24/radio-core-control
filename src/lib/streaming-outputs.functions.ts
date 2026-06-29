import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/services/database/auth-middleware";
import {
  getAdapter, listAdapters, type StreamingOutput, type StreamingOutputType,
} from "@/server/streaming-adapters.server";

export const listStreamingAdapters = createServerFn({ method: "GET" })
  .handler(async () => {
    return listAdapters().map((a) => ({
      type: a.type,
      label: a.label,
      description: a.description,
      capabilities: a.capabilities,
    }));
  });

export const probeStreamingOutput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { outputId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("streaming_outputs").select("*").eq("id", data.outputId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Output not found");

    const o = row as unknown as StreamingOutput;
    const adapter = getAdapter(o.type);
    const url = o.listener_stats_url ?? adapter.defaultStatsUrl(o);

    let status: "unknown" | "healthy" | "degraded" | "down" = "unknown";
    let listeners: number | null = null;
    let message = "";

    if (!url) {
      status = "unknown";
      message = "No listener stats endpoint for this adapter type";
    } else {
      try {
        const ctrl = AbortSignal.timeout(5000);
        const res = await fetch(url, { signal: ctrl, headers: { "User-Agent": "RadioCore-Probe/1.0" } });
        if (!res.ok) {
          status = "down";
          message = `HTTP ${res.status}`;
        } else {
          status = "healthy";
          // Best-effort listener parsing for icecast/shoutcast JSON
          try {
            const json: any = await res.json();
            const src = json?.icestats?.source;
            if (Array.isArray(src)) {
              const m = src.find((s: any) => s.listenurl?.endsWith(o.mountpoint ?? "")) ?? src[0];
              listeners = m?.listeners ?? null;
            } else if (src) {
              listeners = src.listeners ?? null;
            } else if (typeof json?.currentlisteners === "number") {
              listeners = json.currentlisteners;
            }
          } catch {
            /* not json — still healthy */
          }
        }
      } catch (e: any) {
        status = "down";
        message = e?.message ?? "probe failed";
      }
    }

    await supabase.from("streaming_outputs").update({
      health_status: status,
      last_health_at: new Date().toISOString(),
      last_listeners: listeners,
    }).eq("id", o.id);

    return { status, listeners, message, url, publicUrl: adapter.publicUrl(o) };
  });

export const renderOutputPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { outputId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase.from("streaming_outputs").select("*,stations(name,slug,id)")
      .eq("id", data.outputId).maybeSingle();
    if (!row) throw new Error("Output not found");
    const o = row as any;
    const adapter = getAdapter(o.type as StreamingOutputType);
    const liq = adapter.renderLiquidsoap(o as StreamingOutput, {
      station: { id: o.stations.id, name: o.stations.name, slug: o.stations.slug },
      sourceVar: "radio",
    });
    return {
      liq,
      publicUrl: adapter.publicUrl(o as StreamingOutput),
      defaultStatsUrl: adapter.defaultStatsUrl(o as StreamingOutput),
      capabilities: adapter.capabilities,
      label: adapter.label,
    };
  });
