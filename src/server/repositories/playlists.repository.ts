/**
 * Playlists repository — Drizzle ORM
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { playlists, playlistAssignments } from "@/server/db/schema";

export type PlaylistRow = typeof playlists.$inferSelect;
export type PlaylistAssignmentRow = typeof playlistAssignments.$inferSelect;

export async function listPlaylists(): Promise<PlaylistRow[]> {
  return db.select().from(playlists).orderBy(playlists.priority);
}

export async function findPlaylistById(id: string): Promise<PlaylistRow | null> {
  const rows = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPlaylist(
  data: typeof playlists.$inferInsert,
): Promise<PlaylistRow> {
  const rows = await db.insert(playlists).values(data).returning();
  return rows[0];
}

export async function updatePlaylist(
  id: string,
  data: Partial<typeof playlists.$inferInsert>,
): Promise<PlaylistRow | null> {
  const rows = await db
    .update(playlists)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(playlists.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deletePlaylist(id: string): Promise<boolean> {
  const rows = await db.delete(playlists).where(eq(playlists.id, id)).returning({ id: playlists.id });
  return rows.length > 0;
}

export async function listPlaylistItems(playlistId: string): Promise<PlaylistAssignmentRow[]> {
  return db
    .select()
    .from(playlistAssignments)
    .where(eq(playlistAssignments.playlistId, playlistId))
    .orderBy(desc(playlistAssignments.weight));
}

export async function addPlaylistItem(
  playlistId: string,
  mediaFileId: string,
): Promise<PlaylistAssignmentRow> {
  const rows = await db
    .insert(playlistAssignments)
    .values({ playlistId, mediaFileId })
    .returning();
  return rows[0];
}

export async function removePlaylistItem(playlistId: string, mediaFileId: string): Promise<boolean> {
  const rows = await db
    .delete(playlistAssignments)
    .where(
      and(
        eq(playlistAssignments.playlistId, playlistId),
        eq(playlistAssignments.mediaFileId, mediaFileId),
      ),
    )
    .returning({ id: playlistAssignments.id });
  return rows.length > 0;
}
