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
  streamingOutputs,
} from "@/server/db/schema";

export type IcecastConfigRow = typeof icecastConfigs.$inferSelect;
export type LiquidsoapConfigRow = typeof liquidsoapConfigs.$inferSelect;
export type StreamMountRow = typeof streamMounts.$inferSelect;
export type PlaylistRow = typeof playlists.$inferSelect;
export type LiveInputRow = typeof liveInputs.$inferSelect;
export type FallbackTrackRow = typeof fallbackTracks.$inferSelect;
export type StreamingOutputRow = typeof streamingOutputs.$inferSelect;

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

// ─── Admin CRUD (dashboard) ─────────────────────────────────────────────────
// The functions above are the read path consumed by api.public.station-config
// (pulled by the broadcast agent). Everything below is for the admin
// dashboard that manages this configuration.

export async function upsertIcecastConfig(
  stationId: string,
  data: Partial<typeof icecastConfigs.$inferInsert>,
): Promise<IcecastConfigRow> {
  const existing = await getIcecastConfig(stationId);
  if (existing) {
    const rows = await db
      .update(icecastConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(icecastConfigs.id, existing.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(icecastConfigs).values({ ...data, stationId }).returning();
  return rows[0];
}

export async function upsertLiquidsoapConfig(
  stationId: string,
  data: Partial<typeof liquidsoapConfigs.$inferInsert>,
): Promise<LiquidsoapConfigRow> {
  const existing = await getLiquidsoapConfig(stationId);
  if (existing) {
    const rows = await db
      .update(liquidsoapConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(liquidsoapConfigs.id, existing.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(liquidsoapConfigs).values({ ...data, stationId }).returning();
  return rows[0];
}

export async function listStreamMounts(stationId: string): Promise<StreamMountRow[]> {
  return db.select().from(streamMounts).where(eq(streamMounts.stationId, stationId));
}

export async function createStreamMount(
  data: typeof streamMounts.$inferInsert,
): Promise<StreamMountRow> {
  const rows = await db.insert(streamMounts).values(data).returning();
  return rows[0];
}

export async function updateStreamMount(
  id: string,
  data: Partial<typeof streamMounts.$inferInsert>,
): Promise<StreamMountRow | null> {
  const rows = await db
    .update(streamMounts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(streamMounts.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteStreamMount(id: string): Promise<boolean> {
  const rows = await db
    .delete(streamMounts)
    .where(eq(streamMounts.id, id))
    .returning({ id: streamMounts.id });
  return rows.length > 0;
}

export async function listLiveInputs(stationId: string): Promise<LiveInputRow[]> {
  return db.select().from(liveInputs).where(eq(liveInputs.stationId, stationId));
}

export async function createLiveInput(
  data: typeof liveInputs.$inferInsert,
): Promise<LiveInputRow> {
  const rows = await db.insert(liveInputs).values(data).returning();
  return rows[0];
}

export async function updateLiveInput(
  id: string,
  data: Partial<typeof liveInputs.$inferInsert>,
): Promise<LiveInputRow | null> {
  const rows = await db
    .update(liveInputs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(liveInputs.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteLiveInput(id: string): Promise<boolean> {
  const rows = await db.delete(liveInputs).where(eq(liveInputs.id, id)).returning({ id: liveInputs.id });
  return rows.length > 0;
}

export async function listFallbackTracks(stationId: string): Promise<FallbackTrackRow[]> {
  return db.select().from(fallbackTracks).where(eq(fallbackTracks.stationId, stationId));
}

export async function createFallbackTrack(
  data: typeof fallbackTracks.$inferInsert,
): Promise<FallbackTrackRow> {
  const rows = await db.insert(fallbackTracks).values(data).returning();
  return rows[0];
}

export async function updateFallbackTrack(
  id: string,
  data: Partial<typeof fallbackTracks.$inferInsert>,
): Promise<FallbackTrackRow | null> {
  const rows = await db
    .update(fallbackTracks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(fallbackTracks.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteFallbackTrack(id: string): Promise<boolean> {
  const rows = await db
    .delete(fallbackTracks)
    .where(eq(fallbackTracks.id, id))
    .returning({ id: fallbackTracks.id });
  return rows.length > 0;
}

export async function listStreamingOutputs(stationId: string): Promise<StreamingOutputRow[]> {
  return db.select().from(streamingOutputs).where(eq(streamingOutputs.stationId, stationId));
}

export async function createStreamingOutput(
  data: typeof streamingOutputs.$inferInsert,
): Promise<StreamingOutputRow> {
  const rows = await db.insert(streamingOutputs).values(data).returning();
  return rows[0];
}

export async function updateStreamingOutput(
  id: string,
  data: Partial<typeof streamingOutputs.$inferInsert>,
): Promise<StreamingOutputRow | null> {
  const rows = await db
    .update(streamingOutputs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(streamingOutputs.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteStreamingOutput(id: string): Promise<boolean> {
  const rows = await db
    .delete(streamingOutputs)
    .where(eq(streamingOutputs.id, id))
    .returning({ id: streamingOutputs.id });
  return rows.length > 0;
}
