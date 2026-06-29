/**
 * Public station data — server functions for the public listener site.
 * Uses admin client (RLS-bypass) with explicit safe-column projection.
 * Never returns secrets, passwords, or internal IDs beyond the station row.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.object({ slug: z.string().min(1).max(120).optional() });

export type PublicStation = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  demo_artwork_url: string | null;
  demo_stream_url: string | null;
  demo_mode: boolean;
};

export type PublicStreamProfile = {
  id: string;
  label: string;
  url: string;
  format: "hls" | "aac" | "mp3";
  bitrate: number | null;
};

export type PublicNowPlaying = {
  title: string | null;
  artist: string | null;
  album: string | null;
  started_at: string | null;
  listeners: number | null;
};

export type PublicScheduleBlock = {
  id: string;
  name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
};

/** Resolve a station by slug; if no slug given, returns first active station. */
export const getPublicStation = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => slugSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<PublicStation | null> => {
    const { adminDatabase } = await import("@/services/database/server");
    const query = adminDatabase
      .from("stations")
      .select("id,name,slug,description,demo_artwork_url,demo_stream_url,demo_mode")
      .eq("is_active", true);
    const { data: row } = data.slug
      ? await query.eq("slug", data.slug).maybeSingle()
      : await query.order("name").limit(1).maybeSingle();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      demo_artwork_url: row.demo_artwork_url,
      demo_stream_url: row.demo_stream_url,
      demo_mode: row.demo_mode,
    };
  });

/** Get public stream URLs for a station. Builds full URLs from icecast config. */
export const getPublicStreams = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PublicStreamProfile[]> => {
    const { adminDatabase } = await import("@/services/database/server");
    const [{ data: mounts }, { data: ic }, { data: station }] = await Promise.all([
      adminDatabase
        .from("stream_mounts")
        .select("id,mount_path,format,bitrate,is_default,is_active")
        .eq("station_id", data.stationId)
        .eq("is_active", true),
      adminDatabase
        .from("icecast_configs")
        .select("hostname,port")
        .eq("station_id", data.stationId)
        .maybeSingle(),
      adminDatabase
        .from("stations")
        .select("demo_stream_url,demo_mode")
        .eq("id", data.stationId)
        .maybeSingle(),
    ]);

    // Demo mode: synthesize a single profile from demo_stream_url.
    if (station?.demo_mode && station.demo_stream_url) {
      const url = station.demo_stream_url;
      const fmt: "hls" | "aac" | "mp3" =
        url.includes(".m3u8") ? "hls" : url.includes(".aac") ? "aac" : "mp3";
      return [{ id: "demo", label: fmt === "hls" ? "Auto (HLS)" : `Demo (${fmt.toUpperCase()})`, url, format: fmt, bitrate: null }];
    }

    if (!mounts?.length) return [];
    const base = ic ? `https://${ic.hostname}${ic.port && ic.port !== 443 ? `:${ic.port}` : ""}` : "";
    const profiles: PublicStreamProfile[] = mounts.map((m) => {
      const fmt = String(m.format ?? "mp3").toLowerCase();
      const format: "hls" | "aac" | "mp3" =
        fmt.includes("hls") ? "hls" : fmt.includes("aac") ? "aac" : "mp3";
      const path = m.mount_path.startsWith("/") ? m.mount_path : `/${m.mount_path}`;
      const url = base ? `${base}${path}` : path;
      const label = format === "hls"
        ? "Auto (HLS)"
        : `${format.toUpperCase()}${m.bitrate ? ` ${m.bitrate}k` : ""}`;
      return { id: m.id, label, url, format, bitrate: m.bitrate ?? null };
    });
    return profiles;
  });

/** Now playing for a station (no auth — public read). */
export const getPublicNowPlaying = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PublicNowPlaying | null> => {
    const { adminDatabase } = await import("@/services/database/server");
    const { data: np } = await adminDatabase
      .from("now_playing")
      .select("title,artist,album,listeners,started_at")
      .eq("station_id", data.stationId)
      .maybeSingle();
    if (!np) return null;
    return {
      title: np.title,
      artist: np.artist,
      album: np.album,
      started_at: np.started_at,
      listeners: np.listeners,
    };
  });

/** Recently played (last 12 tracks) for a station. */
export const getPublicRecentlyPlayed = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { adminDatabase } = await import("@/services/database/server");
    const { data: rows } = await adminDatabase
      .from("play_history")
      .select("id,title,artist,album,played_at")
      .eq("station_id", data.stationId)
      .order("played_at", { ascending: false })
      .limit(12);
    return (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      album: r.album,
      played_at: r.played_at,
    }));
  });

/** Upcoming schedule blocks for a station (next 7 by start time). */
export const getPublicSchedule = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PublicScheduleBlock[]> => {
    const { adminDatabase } = await import("@/services/database/server");
    const { data: rows } = await adminDatabase
      .from("schedule_blocks")
      .select("id,name,day_of_week,start_time,end_time,is_active")
      .eq("station_id", data.stationId)
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time")
      .limit(60);
    return (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      day_of_week: String(r.day_of_week),
      start_time: String(r.start_time),
      end_time: String(r.end_time),
    }));
  });
