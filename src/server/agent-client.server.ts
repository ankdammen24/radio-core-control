/**
 * Radio Core Agent client. Server-only.
 *
 * Migrerad från Supabase till Drizzle ORM.
 * logEvent skriver till system_events-tabellen.
 *
 * TODO: ersätt pingAgent/dispatchJob/revokeAgent med riktiga HTTP-anrop
 * när en riktig Radio Core Agent är ihopkopplad.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { systemEvents, stackTokens, agentInstances } from "@/server/db/schema";

export type AgentRow = {
  id: string;
  station_id: string | null;
  name: string;
  hostname: string | null;
  status: string;
  stack_token_id: string | null;
};

export type AgentJob = {
  type: string;
  payload?: Record<string, unknown>;
};

async function logEvent(input: {
  station_id: string | null;
  level: "info" | "warning" | "error" | "critical";
  event_type: string;
  message: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(systemEvents).values({
    source: "agent",
    stationId: input.station_id,
    level: input.level,
    eventType: input.event_type,
    message: input.message,
    details: (input.details ?? {}) as never,
  });
}

export async function pingAgent(agent: AgentRow) {
  await logEvent({
    station_id: agent.station_id,
    level: "info",
    event_type: "agent.ping",
    message: `Ping requested for agent ${agent.name}`,
    details: { agent_id: agent.id, hostname: agent.hostname },
  });
  return { ok: true, mocked: true as const, message: "Agent ping is mocked until a real Radio Core Agent is paired." };
}

export async function dispatchJob(agent: AgentRow, job: AgentJob) {
  await logEvent({
    station_id: agent.station_id,
    level: "info",
    event_type: "agent.dispatch",
    message: `Dispatched ${job.type} to ${agent.name} (mocked)`,
    details: { agent_id: agent.id, job_type: job.type, payload: job.payload ?? {} },
  });
  return { ok: true, mocked: true as const };
}

export async function revokeAgent(agent: AgentRow) {
  if (agent.stack_token_id) {
    await db
      .update(stackTokens)
      .set({ isActive: false })
      .where(eq(stackTokens.id, agent.stack_token_id));
  }
  await db
    .update(agentInstances)
    .set({ status: "offline", lastError: "Revoked by operator", updatedAt: new Date() })
    .where(eq(agentInstances.id, agent.id));
  await logEvent({
    station_id: agent.station_id,
    level: "warning",
    event_type: "agent.revoke",
    message: `Agent ${agent.name} revoked`,
    details: { agent_id: agent.id },
  });
  return { ok: true };
}
