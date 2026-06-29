/**
 * Health repository — Drizzle ORM
 *
 * Hanterar service_health-poster: skriva statusposter och hämta senaste status per tjänst.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { serviceHealth, type NewServiceHealth } from "@/server/db/schema";

export type ServiceHealthRow = typeof serviceHealth.$inferSelect;

export async function insertServiceHealth(row: NewServiceHealth): Promise<void> {
  await db.insert(serviceHealth).values(row);
}

/** Hämtar de senaste N service_health-posterna (standardvärde: 500). */
export async function getRecentServiceHealth(limit = 500): Promise<ServiceHealthRow[]> {
  return db
    .select()
    .from(serviceHealth)
    .orderBy(desc(serviceHealth.reportedAt))
    .limit(limit);
}

/** Hämtar senaste post för varje tjänst (aggregerad). */
export async function getLatestHealthByService(): Promise<
  { service: string; status: string; lastReportedAt: Date | null }[]
> {
  // Drizzle stödjer inte GROUP BY med DISTINCT ON direkt — vi aggregerar i JS.
  const rows = await getRecentServiceHealth(500);
  const seen = new Map<string, ServiceHealthRow>();
  for (const r of rows) {
    if (!seen.has(r.service)) seen.set(r.service, r);
  }
  return Array.from(seen.values()).map((r) => ({
    service: r.service,
    status: r.status,
    lastReportedAt: r.reportedAt,
  }));
}
