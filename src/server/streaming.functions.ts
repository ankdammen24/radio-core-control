import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  renderIcecastXml, renderLiquidsoapLiq, renderM3u,
  type StationRow, type IcecastRow, type MountRow, type LiqRow, type PlaylistEntry, type LiveInputRow,
} from "./streaming.server";

type GenInput = { stationId: string; persist?: boolean };

export const generateStationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const stationId = data.stationId;

    const [{ data: station }, { data: ic }, { data: mounts }, { data: liq }, { data: pls }, { data: live }] = await Promise.all([
      supabase.from("stations").select("id,name,slug").eq("id", stationId).maybeSingle(),
      supabase.from("icecast_configs").select("*").eq("station_id", stationId).maybeSingle(),
      supabase.from("stream_mounts").select("mount_path,format,bitrate,is_default").eq("station_id", stationId).eq("is_active", true),
      supabase.from("liquidsoap_configs").select("*").eq("station_id", stationId).maybeSingle(),
      supabase.from("playlists").select("id,name,priority,is_active").eq("station_id", stationId).eq("is_active", true),
      supabase.from("live_inputs").select("*").eq("station_id", stationId).maybeSingle(),
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

    const apiBaseUrl = process.env.PUBLIC_APP_URL ?? `https://project--${process.env.SUPABASE_PROJECT_ID ?? ""}.lovable.app`;
    const stackToken = "REPLACE_WITH_STACK_TOKEN";

    const icecastXml = renderIcecastXml(station as StationRow, ic as IcecastRow, mounts as MountRow[]);
    const liquidsoapLiq = renderLiquidsoapLiq(
      station as StationRow, ic as IcecastRow, defaultMount, liq as LiqRow, playlists, apiBaseUrl, stackToken, live as LiveInputRow | null,
    );
    const m3uFiles = playlists.map((p, i) => ({
      name: `pl_${i}_${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.m3u`,
      content: renderM3u(p.files),
    }));

    if (data.persist) {
      await supabase.from("liquidsoap_configs").update({
        generated_at: new Date().toISOString(),
        generated_liq: liquidsoapLiq,
      }).eq("station_id", stationId);
    }

    return { station, icecastXml, liquidsoapLiq, m3uFiles, mounts, playlistsCount: playlists.length };
  });
