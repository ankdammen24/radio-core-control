/**
 * Media sources repository — Drizzle ORM
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mediaSources, syncRuns } from "@/server/db/schema";

export type MediaSourceRow = typeof mediaSources.$inferSelect;
export type SyncRunRow = typeof syncRuns.$inferSelect;

export async function listMediaSources(): Promise<MediaSourceRow[]> {
  return db.select().from(mediaSources).orderBy(mediaSources.name);
}

export async function findMediaSourceById(id: string): Promise<MediaSourceRow | null> {
  const rows = await db.select().from(mediaSources).where(eq(mediaSources.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createMediaSource(
  data: typeof mediaSources.$inferInsert,
): Promise<MediaSourceRow> {
  const rows = await db.insert(mediaSources).values(data).returning();
  return rows[0];
}

export async function updateMediaSource(
  id: string,
  data: Partial<typeof mediaSources.$inferInsert>,
): Promise<MediaSourceRow | null> {
  const rows = await db
    .update(mediaSources)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(mediaSources.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteMediaSource(id: string): Promise<boolean> {
  const rows = await db
    .delete(mediaSources)
    .where(eq(mediaSources.id, id))
    .returning({ id: mediaSources.id });
  return rows.length > 0;
}

export async function touchMediaSourceSynced(id: string): Promise<void> {
  await db.update(mediaSources).set({ lastSyncedAt: new Date() }).where(eq(mediaSources.id, id));
}

export async function listSyncRuns(sourceId: string, limit = 25): Promise<SyncRunRow[]> {
  return db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.sourceId, sourceId))
    .orderBy(syncRuns.startedAt)
    .limit(limit);
}

export async function startSyncRun(sourceId: string): Promise<SyncRunRow> {
  const rows = await db.insert(syncRuns).values({ sourceId, status: "running" }).returning();
  return rows[0];
}

export async function finishSyncRun(
  id: string,
  data: Partial<typeof syncRuns.$inferInsert>,
): Promise<void> {
  await db
    .update(syncRuns)
    .set({ ...data, finishedAt: new Date() })
    .where(eq(syncRuns.id, id));
}
