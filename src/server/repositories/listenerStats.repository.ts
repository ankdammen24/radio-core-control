/**
 * ListenerStats repository — Drizzle ORM
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { listenerStats, stations, type NewListenerStat } from "@/server/db/schema";

export type ListenerStatRow = typeof listenerStats.$inferSelect;

export async function insertListenerStat(row: NewListenerStat): Promise<void> {
  await db.insert(listenerStats).values(row);
}

export async function getListenerStats(opts: {
  stationId?: string;
  slug?: string;
  limit?: number;
}): Promise<(ListenerStatRow & { stationSlug: string; stationName: string })[]> {
  const limit = opts.limit ?? 200;

  const rows = await db
    .select({
      id: listenerStats.id,
      stationId: listenerStats.stationId,
      mountPath: listenerStats.mountPath,
      listeners: listenerStats.listeners,
      peakListeners: listenerStats.peakListeners,
      recordedAt: listenerStats.recordedAt,
      stationSlug: stations.slug,
      stationName: stations.name,
    })
    .from(listenerStats)
    .innerJoin(stations, eq(listenerStats.stationId, stations.id))
    .where(
      opts.stationId
        ? eq(listenerStats.stationId, opts.stationId)
        : opts.slug
          ? eq(stations.slug, opts.slug)
          : undefined,
    )
    .orderBy(desc(listenerStats.recordedAt))
    .limit(limit);

  return rows;
}
