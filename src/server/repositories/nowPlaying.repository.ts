/**
 * NowPlaying repository — Drizzle ORM
 *
 * nowPlaying-tabellen har station_id som PK (en rad per station).
 * Alla uppdateringar sker via upsert.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { nowPlaying, playHistory, stations, type NewNowPlaying, type NewPlayHistory } from "@/server/db/schema";

export type NowPlayingRow = typeof nowPlaying.$inferSelect;

export async function upsertNowPlaying(row: NewNowPlaying): Promise<void> {
  await db
    .insert(nowPlaying)
    .values({ ...row, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: nowPlaying.stationId,
      set: {
        title: row.title,
        artist: row.artist,
        album: row.album,
        mountPath: row.mountPath,
        listeners: row.listeners ?? 0,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

/** Hämtar now_playing med stationsinfo (slug, name). */
export async function getNowPlaying(
  slug?: string,
): Promise<(NowPlayingRow & { stationSlug: string; stationName: string })[]> {
  const rows = await db
    .select({
      stationId: nowPlaying.stationId,
      title: nowPlaying.title,
      artist: nowPlaying.artist,
      album: nowPlaying.album,
      mountPath: nowPlaying.mountPath,
      listeners: nowPlaying.listeners,
      durationSeconds: nowPlaying.durationSeconds,
      mediaFileId: nowPlaying.mediaFileId,
      startedAt: nowPlaying.startedAt,
      updatedAt: nowPlaying.updatedAt,
      stationSlug: stations.slug,
      stationName: stations.name,
    })
    .from(nowPlaying)
    .innerJoin(stations, eq(nowPlaying.stationId, stations.id))
    .where(slug ? eq(stations.slug, slug) : undefined);
  return rows;
}

export async function insertPlayHistory(row: NewPlayHistory): Promise<void> {
  await db.insert(playHistory).values(row);
}
