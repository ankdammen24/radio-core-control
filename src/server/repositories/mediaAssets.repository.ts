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
