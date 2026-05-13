// Radio Core Agent client. Server-only.
//
// This is the typed contract the future Node.js agent will satisfy. Until a
// real agent is paired, every call is mocked: it logs a system_event row so
// the UI feed stays useful, and returns { ok: true, mocked: true }.
//
// To wire a real agent, replace the bodies of pingAgent/dispatchJob/
// revokeAgent with real HTTP calls keyed by the linked stack_token.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  await supabaseAdmin.from("system_events").insert({
    source: "agent",
    station_id: input.station_id,
    level: input.level,
    event_type: input.event_type,
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
    await supabaseAdmin
      .from("stack_tokens")
      .update({ is_active: false })
      .eq("id", agent.stack_token_id);
  }
  await supabaseAdmin
    .from("agent_instances")
    .update({ status: "offline", last_error: "Revoked by operator" })
    .eq("id", agent.id);
  await logEvent({
    station_id: agent.station_id,
    level: "warning",
    event_type: "agent.revoke",
    message: `Agent ${agent.name} revoked`,
    details: { agent_id: agent.id },
  });
  return { ok: true };
}
