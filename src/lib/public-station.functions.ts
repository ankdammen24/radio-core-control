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
    const { listStations } = await import("@/services/stations");
    const stations = await listStations();
    const row = data.slug
      ? stations.data.find((station) => station.slug === data.slug && station.is_active)
      : stations.data.find((station) => station.is_active);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      demo_artwork_url: null,
      demo_stream_url: null,
      demo_mode: false,
    };
  });

/** Get public stream URLs for a station. Builds full URLs from Drizzle (Postgres). */
export const getPublicStreams = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PublicStreamProfile[]> => {
    const { listStreamMounts, getIcecastConfig } = await import("@/server/repositories/streaming.repository");
    const [mounts, ic] = await Promise.all([
      listStreamMounts(data.stationId),
      getIcecastConfig(data.stationId),
    ]);
    if (!mounts.length) return [];
    const base = ic
      ? `https://${ic.hostname}${ic.port && ic.port !== 443 ? `:${ic.port}` : ""}`
      : "";
    return mounts
      .filter((m) => m.isActive)
      .map((m) => {
        const fmt = String(m.format ?? "mp3").toLowerCase();
        const format: "hls" | "aac" | "mp3" = fmt.includes("hls") ? "hls" : fmt.includes("aac") ? "aac" : "mp3";
        const path = m.mountPath.startsWith("/") ? m.mountPath : `/${m.mountPath}`;
        const url = base ? `${base}${path}` : path;
        const label = format === "hls" ? "Auto (HLS)" : `${format.toUpperCase()}${m.bitrate ? ` ${m.bitrate}k` : ""}`;
        return { id: m.id, label, url, format, bitrate: m.bitrate ?? null };
      });
  });

/** Now playing for a station — placeholder until runtime table exists. */
export const getPublicNowPlaying = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async (_): Promise<PublicNowPlaying | null> => {
    return null;
  });

/** Recently played — placeholder until play_history table exists. */
export const getPublicRecentlyPlayed = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async (_) => {
    return [] as { id: string; title: string | null; artist: string | null; album: string | null; played_at: string | null }[];
  });

/** Upcoming schedule blocks — placeholder until schedule_blocks table exists. */
export const getPublicSchedule = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ stationId: z.string().uuid() }).parse(input))
  .handler(async (_): Promise<PublicScheduleBlock[]> => {
    return [];
  });
