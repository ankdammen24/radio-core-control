/**
 * Streaming repository — Drizzle ORM
 *
 * Hämtar konfigurationsdata för station-config-endpointen:
 * icecast_configs, liquidsoap_configs, stream_mounts, playlists,
 * playlist_assignments, live_inputs, fallback_tracks
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  icecastConfigs, liquidsoapConfigs, streamMounts,
  playlists, playlistAssignments, liveInputs, fallbackTracks, mediaFiles,
} from "@/server/db/schema";

export type IcecastConfigRow = typeof icecastConfigs.$inferSelect;
export type LiquidsoapConfigRow = typeof liquidsoapConfigs.$inferSelect;
export type StreamMountRow = typeof streamMounts.$inferSelect;
export type PlaylistRow = typeof playlists.$inferSelect;
export type LiveInputRow = typeof liveInputs.$inferSelect;

export async function getIcecastConfig(stationId: string): Promise<IcecastConfigRow | null> {
  const rows = await db
    .select()
    .from(icecastConfigs)
    .where(eq(icecastConfigs.stationId, stationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLiquidsoapConfig(stationId: string): Promise<LiquidsoapConfigRow | null> {
  const rows = await db
    .select()
    .from(liquidsoapConfigs)
    .where(eq(liquidsoapConfigs.stationId, stationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveStreamMounts(stationId: string): Promise<StreamMountRow[]> {
  return db
    .select()
    .from(streamMounts)
    .where(and(eq(streamMounts.stationId, stationId), eq(streamMounts.isActive, true)));
}

export async function getActivePlaylists(stationId: string): Promise<PlaylistRow[]> {
  return db
    .select()
    .from(playlists)
    .where(and(eq(playlists.stationId, stationId), eq(playlists.isActive, true)));
}

export type PlaylistWithFiles = {
  name: string;
  weight: number;
  files: string[];
};

export async function getPlaylistFiles(
  playlistId: string,
  stationSlug: string,
): Promise<PlaylistWithFiles | null> {
  const pl = await db
    .select({ name: playlists.name, priority: playlists.priority })
    .from(playlists)
    .where(eq(playlists.id, playlistId))
    .limit(1);
  if (!pl[0]) return null;

  const assigns = await db
    .select({
      filePath: mediaFiles.filePath,
      fileName: mediaFiles.fileName,
    })
    .from(playlistAssignments)
    .innerJoin(mediaFiles, eq(playlistAssignments.mediaFileId, mediaFiles.id))
    .where(
      and(
        eq(playlistAssignments.playlistId, playlistId),
        eq(playlistAssignments.isActive, true),
      ),
    );

  const files = assigns
    .map((a) => a.filePath ?? a.fileName)
    .filter((f): f is string => !!f)
    .map((rel) =>
      rel.startsWith("/") ? rel : `/data/stations/${stationSlug}/media/${rel}`,
    );

  return { name: pl[0].name, weight: pl[0].priority ?? 1, files };
}

export type FallbackEntry = { label: string; path: string; priority: number };

export async function getActiveFallbacks(
  stationId: string,
  stationSlug: string,
): Promise<FallbackEntry[]> {
  const rows = await db
    .select({
      label: fallbackTracks.label,
      priority: fallbackTracks.priority,
      externalUrl: fallbackTracks.externalUrl,
      filePath: mediaFiles.filePath,
      fileName: mediaFiles.fileName,
    })
    .from(fallbackTracks)
    .leftJoin(mediaFiles, eq(fallbackTracks.mediaFileId, mediaFiles.id))
    .where(
      and(eq(fallbackTracks.stationId, stationId), eq(fallbackTracks.isActive, true)),
    )
    .orderBy(fallbackTracks.priority);

  return rows
    .map((r) => {
      const rel = r.filePath ?? r.fileName ?? null;
      const path =
        r.externalUrl ??
        (rel ? (rel.startsWith("/") ? rel : `/data/stations/${stationSlug}/media/${rel}`) : "");
      return { label: r.label, path, priority: r.priority ?? 10 };
    })
    .filter((f) => !!f.path);
}

export async function getLiveInput(stationId: string): Promise<LiveInputRow | null> {
  const rows = await db
    .select()
    .from(liveInputs)
    .where(eq(liveInputs.stationId, stationId))
    .limit(1);
  return rows[0] ?? null;
}
