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
  logo_url: string | null;
  accent_color: string | null;
  public_url: string | null;
  slogan: string | null;
  default_artwork_url: string | null;
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
  artwork_url: string | null;
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const query = supabaseAdmin
      .from("stations")
      .select("id,name,slug,description,is_active")
      .eq("is_active", true);
    const { data: row } = data.slug
      ? await query.eq("slug", data.slug).maybeSingle()
      : await query.order("name").limit(1).maybeSingle();
    if (!row) return null;
    // Defensive projection — extra brand columns are optional in schema.
    const r = row as unknown as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      description: (r.description as string | null) ?? null,
      logo_url: (r.logo_url as string | null) ?? null,
      accent_color: (r.accent_color as string | null) ?? null,
      public_url: (r.public_url as string | null) ?? null,
      slogan: (r.slogan as string | null) ?? null,
      default_artwork_url: (r.default_artwork_url as string | null) ?? null,
    } satisfies PublicStation;
  });

/** Get public stream URLs for a station (HLS + Icecast mounts). */
export const getPublicStreams = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mounts } = await supabaseAdmin
      .from("stream_mounts")
      .select("id,mount_path,format,bitrate,is_default,is_active,public_url")
      .eq("station_id", data.stationId)
      .eq("is_active", true);
    const profiles: PublicStreamProfile[] = (mounts ?? []).map((m) => {
      const row = m as unknown as Record<string, unknown>;
      const fmt = String(row.format ?? "mp3").toLowerCase();
      const format: "hls" | "aac" | "mp3" =
        fmt.includes("hls") ? "hls" : fmt.includes("aac") ? "aac" : "mp3";
      const url = (row.public_url as string | null) ?? (row.mount_path as string);
      const bitrate = (row.bitrate as number | null) ?? null;
      const label = format === "hls"
        ? "Auto (HLS)"
        : `${format.toUpperCase()}${bitrate ? ` ${bitrate}k` : ""}`;
      return { id: row.id as string, label, url, format, bitrate };
    }).filter((p) => !!p.url);
    return profiles;
  });

/** Now playing for a station (no auth — public read). */
export const getPublicNowPlaying = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: np } = await supabaseAdmin
      .from("now_playing")
      .select("title,artist,album,listeners,started_at")
      .eq("station_id", data.stationId)
      .maybeSingle();
    if (!np) return null;
    const r = np as unknown as Record<string, unknown>;
    return {
      title: (r.title as string | null) ?? null,
      artist: (r.artist as string | null) ?? null,
      album: (r.album as string | null) ?? null,
      artwork_url: (r.artwork_url as string | null) ?? null,
      started_at: (r.started_at as string | null) ?? null,
      listeners: (r.listeners as number | null) ?? null,
    } satisfies PublicNowPlaying;
  });

/** Recently played (last 12 tracks) for a station. */
export const getPublicRecentlyPlayed = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("play_history")
      .select("id,title,artist,album,played_at,started_at")
      .eq("station_id", data.stationId)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(12);
    return (rows ?? []).map((r) => {
      const row = r as unknown as Record<string, unknown>;
      return {
        id: row.id as string,
        title: (row.title as string | null) ?? null,
        artist: (row.artist as string | null) ?? null,
        album: (row.album as string | null) ?? null,
        played_at: (row.played_at as string | null) ?? (row.started_at as string | null) ?? null,
      };
    });
  });

/** Upcoming schedule blocks for a station (next 7 by start time). */
export const getPublicSchedule = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("schedule_blocks")
      .select("id,name,day_of_week,start_time,end_time,is_active")
      .eq("station_id", data.stationId)
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time")
      .limit(60);
    return (rows ?? []).map((r) => {
      const row = r as unknown as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        day_of_week: String(row.day_of_week ?? ""),
        start_time: String(row.start_time ?? ""),
        end_time: String(row.end_time ?? ""),
      } satisfies PublicScheduleBlock;
    });
  });
