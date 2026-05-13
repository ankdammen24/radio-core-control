import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  renderIcecastXml, renderLiquidsoapLiq, renderM3u,
  type StationRow, type IcecastRow, type MountRow, type LiqRow, type PlaylistEntry, type LiveInputRow, type FallbackEntry,
} from "@/server/streaming.server";

// GET /api/public/station-config?station=<slug>  with x-stack-token header
// Returns icecast.xml, liquidsoap.liq and playlist m3u contents — for the docker stack.
export const Route = createFileRoute("/api/public/station-config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get("x-stack-token") ?? "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const hash = createHash("sha256").update(token).digest("hex");
        const { data: tok } = await supabaseAdmin.from("stack_tokens").select("station_id,is_active").eq("token_hash", hash).maybeSingle();
        if (!tok || !tok.is_active) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const slug = url.searchParams.get("station");
        if (!slug) return Response.json({ error: "station required" }, { status: 400 });

        const { data: station } = await supabaseAdmin.from("stations").select("id,name,slug").eq("slug", slug).maybeSingle();
        if (!station) return new Response("Not found", { status: 404 });

        // Cross-tenant guard: station-scoped tokens may only read their own station's config.
        // Tokens with NULL station_id are treated as global/admin-issued and may read any station.
        if (tok.station_id && tok.station_id !== station.id) {
          return new Response("Forbidden", { status: 403 });
        }

        const [{ data: ic }, { data: mounts }, { data: liq }, { data: pls }, { data: live }, { data: fbRows }] = await Promise.all([
          supabaseAdmin.from("icecast_configs").select("*").eq("station_id", station.id).maybeSingle(),
          supabaseAdmin.from("stream_mounts").select("mount_path,format,bitrate,is_default").eq("station_id", station.id).eq("is_active", true),
          supabaseAdmin.from("liquidsoap_configs").select("*").eq("station_id", station.id).maybeSingle(),
          supabaseAdmin.from("playlists").select("id,name,priority,is_active").eq("station_id", station.id).eq("is_active", true),
          supabaseAdmin.from("live_inputs").select("*").eq("station_id", station.id).maybeSingle(),
          supabaseAdmin.from("fallback_tracks")
            .select("label,priority,external_url,media_files(file_path,file_name)")
            .eq("station_id", station.id).eq("is_active", true).order("priority"),
        ]);
        if (!ic || !liq || !mounts?.length) return Response.json({ error: "Station not fully configured" }, { status: 409 });

        const playlists: PlaylistEntry[] = [];
        for (const p of pls ?? []) {
          const { data: assigns } = await supabaseAdmin
            .from("playlist_assignments")
            .select("weight,is_active,media_files(file_path,file_name)")
            .eq("playlist_id", (p as any).id).eq("is_active", true);
          const files = (assigns ?? [])
            .map((a: any) => a.media_files?.file_path ?? a.media_files?.file_name)
            .filter((x: any): x is string => !!x)
            .map((rel: string) => rel.startsWith("/") ? rel : `/data/stations/${station.slug}/media/${rel}`);
          playlists.push({ name: (p as any).name, weight: (p as any).priority ?? 1, files });
        }

        const fallbacks: FallbackEntry[] = (fbRows ?? []).map((r: any) => {
          const rel = r.media_files?.file_path ?? r.media_files?.file_name ?? null;
          const path = r.external_url
            ?? (rel ? (rel.startsWith("/") ? rel : `/data/stations/${station.slug}/media/${rel}`) : "");
          return { label: r.label, path, priority: r.priority ?? 10 };
        }).filter((f) => !!f.path);

        const defaultMount = (mounts as MountRow[]).find((m) => m.is_default) ?? (mounts as MountRow[])[0];
        const apiBaseUrl = `${url.protocol}//${url.host}`;

        const playlistFiles = playlists.map((p, i) => ({
          file: `pl_${i}_${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.m3u`,
          content: renderM3u(p.files),
        }));
        if (fallbacks.length) {
          playlistFiles.push({ file: "fallback.m3u", content: renderM3u(fallbacks.map((f) => f.path)) });
        }

        return Response.json({
          station,
          icecast_xml: renderIcecastXml(station as StationRow, ic as IcecastRow, mounts as MountRow[]),
          liquidsoap_liq: renderLiquidsoapLiq(station as StationRow, ic as IcecastRow, defaultMount, liq as LiqRow, playlists, apiBaseUrl, token, live as LiveInputRow | null, fallbacks),
          playlists: playlistFiles,
        });
      },
    },
  },
});
