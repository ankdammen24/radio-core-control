/**
 * Media Assets repository — Drizzle ORM
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mediaFiles } from "@/server/db/schema";

export type MediaFileRow = typeof mediaFiles.$inferSelect;

export async function findMediaById(id: string): Promise<MediaFileRow | null> {
  const rows = await db
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listMediaByStation(stationId: string): Promise<MediaFileRow[]> {
  return db.select().from(mediaFiles).where(eq(mediaFiles.stationId, stationId));
}

export async function listMedia(): Promise<MediaFileRow[]> {
  return db.select().from(mediaFiles).orderBy(mediaFiles.createdAt);
}

export async function createMedia(
  data: typeof mediaFiles.$inferInsert,
): Promise<MediaFileRow> {
  const rows = await db.insert(mediaFiles).values(data).returning();
  return rows[0];
}

export async function updateMedia(
  id: string,
  data: Partial<typeof mediaFiles.$inferInsert>,
): Promise<MediaFileRow | null> {
  const rows = await db
    .update(mediaFiles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(mediaFiles.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteMedia(id: string): Promise<boolean> {
  const rows = await db.delete(mediaFiles).where(eq(mediaFiles.id, id)).returning({ id: mediaFiles.id });
  return rows.length > 0;
}
