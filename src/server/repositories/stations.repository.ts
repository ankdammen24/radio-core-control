/**
 * Stations repository — Drizzle ORM
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { stations } from "@/server/db/schema";

export type StationRow = typeof stations.$inferSelect;

export async function findStationBySlug(slug: string): Promise<StationRow | null> {
  const rows = await db
    .select()
    .from(stations)
    .where(eq(stations.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function findStationById(id: string): Promise<StationRow | null> {
  const rows = await db
    .select()
    .from(stations)
    .where(eq(stations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listActiveStations(): Promise<StationRow[]> {
  return db.select().from(stations).where(eq(stations.isActive, true));
}

export async function touchStationUpdatedAt(id: string): Promise<void> {
  await db
    .update(stations)
    .set({ updatedAt: new Date() })
    .where(eq(stations.id, id));
}
