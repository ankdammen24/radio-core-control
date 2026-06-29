/**
 * Runtime Targets repository — Drizzle ORM
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { runtimeTargets } from "@/server/db/schema";

export type RuntimeTargetRow = typeof runtimeTargets.$inferSelect;

export async function findRuntimeTargetById(id: string): Promise<RuntimeTargetRow | null> {
  const rows = await db
    .select()
    .from(runtimeTargets)
    .where(eq(runtimeTargets.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRuntimeTargetsByStation(stationId: string): Promise<RuntimeTargetRow[]> {
  return db
    .select()
    .from(runtimeTargets)
    .where(eq(runtimeTargets.stationId, stationId));
}

export async function updateRuntimeTargetStatus(
  id: string,
  status: string,
  lastError?: string | null,
): Promise<void> {
  await db
    .update(runtimeTargets)
    .set({ status, lastError: lastError ?? null, lastCheckedAt: new Date(), updatedAt: new Date() })
    .where(eq(runtimeTargets.id, id));
}
