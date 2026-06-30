/**
 * Podcasts repository — Drizzle ORM
 */
import { eq, asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { podcasts, podcastEpisodes } from "@/server/db/schema";

export type PodcastRow = typeof podcasts.$inferSelect;
export type PodcastEpisodeRow = typeof podcastEpisodes.$inferSelect;

export async function listPodcasts(): Promise<PodcastRow[]> {
  return db.select().from(podcasts).orderBy(podcasts.title);
}

export async function findPodcastById(id: string): Promise<PodcastRow | null> {
  const rows = await db.select().from(podcasts).where(eq(podcasts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPodcast(
  data: typeof podcasts.$inferInsert,
): Promise<PodcastRow> {
  const rows = await db.insert(podcasts).values(data).returning();
  return rows[0];
}

export async function updatePodcast(
  id: string,
  data: Partial<typeof podcasts.$inferInsert>,
): Promise<PodcastRow | null> {
  const rows = await db
    .update(podcasts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(podcasts.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function listEpisodes(podcastId: string): Promise<PodcastEpisodeRow[]> {
  return db
    .select()
    .from(podcastEpisodes)
    .where(eq(podcastEpisodes.podcastId, podcastId))
    .orderBy(asc(podcastEpisodes.publishedAt));
}

export async function createEpisode(
  data: typeof podcastEpisodes.$inferInsert,
): Promise<PodcastEpisodeRow> {
  const rows = await db.insert(podcastEpisodes).values(data).returning();
  return rows[0];
}
