/**
 * Agents repository — Drizzle ORM
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { agentInstances } from "@/server/db/schema";

export type AgentRow = typeof agentInstances.$inferSelect;

export async function findAgentById(id: string): Promise<AgentRow | null> {
  const rows = await db
    .select()
    .from(agentInstances)
    .where(eq(agentInstances.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertAgentInstance(
  data: typeof agentInstances.$inferInsert,
): Promise<void> {
  await db
    .insert(agentInstances)
    .values(data)
    .onConflictDoUpdate({
      target: agentInstances.id,
      set: {
        hostname: data.hostname,
        version: data.version,
        status: data.status,
        lastSeenAt: data.lastSeenAt,
        capabilities: data.capabilities,
        metrics: data.metrics,
        updatedAt: new Date(),
        ...(data.reloadRequestedAt !== undefined
          ? { reloadRequestedAt: data.reloadRequestedAt }
          : {}),
      },
    });
}
