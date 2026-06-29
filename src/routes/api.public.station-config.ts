/**
 * GET /api/public/station-config?station=<slug>  med x-stack-token
 *
 * Returnerar icecast.xml, liquidsoap.liq och playlist-M3U-filer för Docker-stacken.
 * Migrerad från Supabase till Drizzle ORM.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveStackToken } from "@/server/repositories/stackTokens.repository";
import { findStationBySlug } from "@/server/repositories/stations.repository";
import {
  getIcecastConfig, getLiquidsoapConfig, getActiveStreamMounts,
  getActivePlaylists, getPlaylistFiles, getActiveFallbacks, getLiveInput,
} from "@/server/repositories/streaming.repository";
import {
  renderIcecastXml, renderLiquidsoapLiq, renderM3u,
  type StationRow, type IcecastRow, type MountRow, type LiqRow,
  type PlaylistEntry, type LiveInputRow, type FallbackEntry,
} from "@/server/streaming.server";

// ─── Drizzle-till-streaming.server adapter ────────────────────────────────────
// streaming.server.ts förväntar snake_case-kolumner (Supabase-convention).
// Drizzle-repos returnerar camelCase. Adaptrarna mappar om.

function toIcecastRow(r: NonNullable<Awaited<ReturnType<typeof getIcecastConfig>>>): IcecastRow {
  return {
    hostname: r.hostname,
    port: r.port,
    admin_user: r.adminUser,
    admin_password: r.adminPassword,
    source_password: r.sourcePassword,
    relay_password: r.relayPassword,
    max_clients: r.maxClients,
    max_sources: r.maxSources,
    location: r.location,
    admin_email: r.adminEmail,
  };
}

function toLiqRow(r: NonNullable<Awaited<ReturnType<typeof getLiquidsoapConfig>>>): LiqRow {
  return {
    crossfade_seconds: r.crossfadeSeconds,
    normalize_audio: r.normalizeAudio,
    fallback_track_path: r.fallbackTrackPath,
    custom_liq: r.customLiq,
    telnet_host: r.telnetHost,
    telnet_port: r.telnetPort,
  };
}

function toMountRow(r: Awaited<ReturnType<typeof getActiveStreamMounts>>[number]): MountRow {
  return {
    mount_path: r.mountPath,
    format: r.format,
    bitrate: r.bitrate,
    is_default: r.isDefault,
  };
}

function toLiveInputRow(r: NonNullable<Awaited<ReturnType<typeof getLiveInput>>>): LiveInputRow {
  return {
    mount_path: r.mountPath,
    harbor_port: r.harbourPort,
    source_user: r.sourceUser,
    source_password: r.sourcePassword,
    format: r.format,
    bitrate: r.bitrate,
    auto_takeover: r.autoTakeover,
    forced_takeover: r.forcedTakeover,
    fade_in_seconds: r.fadeInSeconds,
    fade_out_seconds: r.fadeOutSeconds,
    is_enabled: r.isEnabled,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/public/station-config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = request.headers.get("x-stack-token") ?? "";
        if (!raw) return new Response("Unauthorized", { status: 401 });

        const tok = await resolveStackToken(raw);
        if (!tok) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const slug = url.searchParams.get("station");
        if (!slug) return Response.json({ error: "station required" }, { status: 400 });

        const station = await findStationBySlug(slug);
        if (!station) return new Response("Not found", { status: 404 });

        // Cross-tenant guard
        if (tok.stationId && tok.stationId !== station.id) {
          return new Response("Forbidden", { status: 403 });
        }

        // Hämta all konfigurationsdata parallellt
        const [ic, liq, mountRows, playlists, liveInput, fallbacks] = await Promise.all([
          getIcecastConfig(station.id),
          getLiquidsoapConfig(station.id),
          getActiveStreamMounts(station.id),
          getActivePlaylists(station.id),
          getLiveInput(station.id),
          getActiveFallbacks(station.id, station.slug),
        ]);

        if (!ic || !liq || !mountRows.length) {
          return Response.json({ error: "Station not fully configured" }, { status: 409 });
        }

        // Hämta filer för varje aktiv playlist
        const playlistEntries: PlaylistEntry[] = [];
        for (const pl of playlists) {
          const entry = await getPlaylistFiles(pl.id, station.slug);
          if (entry) playlistEntries.push(entry);
        }

        const mounts = mountRows.map(toMountRow);
        const defaultMount = mounts.find((m) => m.is_default) ?? mounts[0];
        const apiBaseUrl = `${url.protocol}//${url.host}`;

        const stationRow: StationRow = { id: station.id, name: station.name, slug: station.slug };
        const icecastRow = toIcecastRow(ic);
        const liqRow = toLiqRow(liq);
        const liveInputRow = liveInput ? toLiveInputRow(liveInput) : null;

        const playlistFiles = playlistEntries.map((p, i) => ({
          file: `pl_${i}_${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.m3u`,
          content: renderM3u(p.files),
        }));
        if (fallbacks.length) {
          playlistFiles.push({ file: "fallback.m3u", content: renderM3u(fallbacks.map((f) => f.path)) });
        }

        return Response.json({
          station: stationRow,
          icecast_xml: renderIcecastXml(stationRow, icecastRow, mounts),
          liquidsoap_liq: renderLiquidsoapLiq(
            stationRow, icecastRow, defaultMount, liqRow,
            playlistEntries, apiBaseUrl, raw, liveInputRow, fallbacks,
          ),
          playlists: playlistFiles,
        });
      },
    },
  },
});
