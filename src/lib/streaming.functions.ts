import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readFileSync } from "node:fs";
import {
  renderIcecastXml, renderLiquidsoapLiq, renderM3u,
  type StationRow, type IcecastRow, type MountRow, type LiqRow, type PlaylistEntry, type LiveInputRow, type FallbackEntry,
} from "@/server/streaming.server";
import { renderOutputsLiq, type StreamingOutput } from "@/server/streaming-adapters.server";

type GenInput = { stationId: string; persist?: boolean };

function readSecretFromEnv(name: string): string | undefined {
  const direct = process.env[name]?.trim();
  if (direct) return direct;

  const filePath = process.env[`${name}_FILE`]?.trim();
  if (!filePath) return undefined;

  const fromFile = readFileSync(filePath, "utf8").trim();
  return fromFile || undefined;
}

export const generateStationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const stationId = data.stationId;

    const [{ data: station }, { data: ic }, { data: mounts }, { data: liq }, { data: pls }, { data: live }, { data: fbRows }, { data: outs }] = await Promise.all([
      supabase.from("stations").select("id,name,slug").eq("id", stationId).maybeSingle(),
      supabase.from("icecast_configs").select("*").eq("station_id", stationId).maybeSingle(),
      supabase.from("stream_mounts").select("mount_path,format,bitrate,is_default").eq("station_id", stationId).eq("is_active", true),
      supabase.from("liquidsoap_configs").select("*").eq("station_id", stationId).maybeSingle(),
      supabase.from("playlists").select("id,name,priority,is_active").eq("station_id", stationId).eq("is_active", true),
      supabase.from("live_inputs").select("*").eq("station_id", stationId).maybeSingle(),
      supabase.from("fallback_tracks")
        .select("label,priority,external_url,media_files(file_path,file_name)")
        .eq("station_id", stationId).eq("is_active", true).order("priority"),
      supabase.from("streaming_outputs").select("*").eq("station_id", stationId).order("priority"),
    ]);

    if (!station) throw new Error("Station not found");
    if (!ic) throw new Error("Icecast config missing for station");
    if (!liq) throw new Error("Liquidsoap config missing for station");
    if (!mounts || mounts.length === 0) throw new Error("No active stream mount configured");

    const defaultMount = (mounts as MountRow[]).find((m) => m.is_default) ?? (mounts as MountRow[])[0];

    // Load playlist entries (filenames per playlist)
    const playlists: PlaylistEntry[] = [];
    for (const p of pls ?? []) {
      const { data: assigns } = await supabase
        .from("playlist_assignments")
        .select("media_file_id, weight, is_active, media_files(file_path,file_name)")
        .eq("playlist_id", (p as any).id)
        .eq("is_active", true);
      const files = (assigns ?? [])
        .map((a: any) => (a.media_files?.file_path ?? a.media_files?.file_name) as string | null)
        .filter((x): x is string => !!x)
        .map((rel) => rel.startsWith("/") ? rel : `/data/stations/${(station as StationRow).slug}/media/${rel}`);
      playlists.push({ name: (p as any).name, weight: (p as any).priority ?? 1, files });
    }

    const apiBaseUrl = process.env.PUBLIC_APP_URL
      ?? process.env.APP_BASE_URL
      ?? `https://project--${process.env.SUPABASE_PROJECT_ID ?? ""}.lovable.app`;
    const stackToken = readSecretFromEnv("STACK_TOKEN");
    if (!stackToken) {
      throw new Error("STACK_TOKEN is missing. Configure it server-side before generating runtime config.");
    }

    const fallbacks: FallbackEntry[] = (fbRows ?? []).map((r: any) => {
      const rel = r.media_files?.file_path ?? r.media_files?.file_name ?? null;
      const path = r.external_url
        ?? (rel ? (rel.startsWith("/") ? rel : `/data/stations/${(station as StationRow).slug}/media/${rel}`) : "");
      return { label: r.label as string, path, priority: (r.priority as number) ?? 10 };
    }).filter((f) => !!f.path);

    const icecastXml = renderIcecastXml(station as StationRow, ic as IcecastRow, mounts as MountRow[]);
    let liquidsoapLiq = renderLiquidsoapLiq(
      station as StationRow, ic as IcecastRow, defaultMount, liq as LiqRow, playlists, apiBaseUrl, stackToken, live as LiveInputRow | null, fallbacks,
    );

    // Append outputs from the pluggable adapter system
    const outputs = (outs ?? []) as unknown as StreamingOutput[];
    if (outputs.length > 0) {
      const outputsLiq = renderOutputsLiq(outputs, {
        station: { id: (station as StationRow).id, name: (station as StationRow).name, slug: (station as StationRow).slug },
        sourceVar: "radio",
      });
      liquidsoapLiq += `\n\n# === Streaming outputs (adapters) ===\n${outputsLiq}`;
    }

    const m3uFiles = playlists.map((p, i) => ({
      name: `pl_${i}_${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.m3u`,
      content: renderM3u(p.files),
    }));
    if (fallbacks.length) {
      m3uFiles.push({ name: "fallback.m3u", content: renderM3u(fallbacks.map((f) => f.path)) });
    }

    if (data.persist) {
      await supabase.from("liquidsoap_configs").update({
        generated_at: new Date().toISOString(),
        generated_liq: liquidsoapLiq,
      }).eq("station_id", stationId);
    }

    return { station, icecastXml, liquidsoapLiq, m3uFiles, mounts, playlistsCount: playlists.length, fallbacksCount: fallbacks.length, outputsCount: outputs.length };
  });
