// Agent instances server functions. Client-importable.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/services/database/auth-middleware";
import { pingAgent, revokeAgent, type AgentRow } from "@/server/agent-client.server";
import { adminDatabase } from "@/services/database/server";

async function requireAdmin(context: { supabase: ReturnType<typeof Object>; userId: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roles } = await (context.supabase as any).from("user_roles").select("role").eq("user_id", context.userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  station_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  hostname: z.string().max(255).nullable().optional(),
  version: z.string().max(50).nullable().optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  stack_token_id: z.string().uuid().nullable().optional(),
});

export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ station_id: z.string().uuid().nullable().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("agent_instances")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.station_id) q = q.eq("station_id", data.station_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { agents: rows ?? [] };
  });

export const upsertAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const payload = {
      station_id: data.station_id ?? null,
      name: data.name,
      hostname: data.hostname ?? null,
      version: data.version ?? null,
      capabilities: (data.capabilities ?? {}) as never,
      metadata: (data.metadata ?? {}) as never,
      stack_token_id: data.stack_token_id ?? null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("agent_instances")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return { ok: true as const, agent: row };
    }
    const { data: row, error } = await context.supabase
      .from("agent_instances")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return { ok: true as const, agent: row };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("agent_instances").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const pingAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: agent, error } = await adminDatabase
      .from("agent_instances")
      .select("id, station_id, name, hostname, status, stack_token_id")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    const result = await pingAgent(agent as AgentRow);
    await adminDatabase
      .from("agent_instances")
      .update({ last_seen_at: new Date().toISOString(), status: "unknown" })
      .eq("id", data.id);
    return result;
  });

export const revokeAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: agent, error } = await adminDatabase
      .from("agent_instances")
      .select("id, station_id, name, hostname, status, stack_token_id")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return revokeAgent(agent as AgentRow);
  });

/**
 * Request a config reload for an agent.
 * Sets reload_requested_at = now(). The next heartbeat from the runner will
 * see reload_requested: true in the response and re-fetch its station config.
 */
export const requestAgentReload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await adminDatabase
      .from("agent_instances")
      .update({ reload_requested_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });
