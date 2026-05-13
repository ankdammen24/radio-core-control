// Server fns for Runtime Targets. Client-importable.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runHealthCheck, loadRuntimeTarget, resolveSecret } from "@/server/runtime-targets.server";
import { buildAdapter } from "@/server/runtime-adapters";

const targetTypeEnum = z.enum(["azuracast", "icecast", "liquidsoap", "stereo_tool", "custom"]);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  station_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: targetTypeEnum,
  base_url: z.string().url().max(500).nullable().optional(),
  api_key_secret_name: z.string().max(120).nullable().optional(),
  external_station_id: z.string().max(120).nullable().optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const upsertRuntimeTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      station_id: data.station_id,
      name: data.name,
      type: data.type,
      base_url: data.base_url ?? null,
      api_key_secret_name: data.api_key_secret_name ?? null,
      external_station_id: data.external_station_id ?? null,
      is_active: data.is_active ?? true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: (data.metadata ?? {}) as any,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("runtime_targets").update(payload).eq("id", data.id).select().single();
      if (error) throw error;
      return { ok: true as const, target: row };
    }
    const { data: row, error } = await supabase
      .from("runtime_targets").insert(payload).select().single();
    if (error) throw error;
    return { ok: true as const, target: row };
  });

export const deleteRuntimeTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("runtime_targets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const testRuntimeTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const result = await runHealthCheck(data.id, context.userId ?? null);
    return { ok: result.status === "ok", ...result };
  });

export const fetchRuntimeNowPlaying = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const cfg = await loadRuntimeTarget(data.id);
    const apiKey = resolveSecret(cfg.api_key_secret_name);
    try {
      const adapter = buildAdapter(cfg, apiKey);
      const np = adapter.fetchNowPlaying ? await adapter.fetchNowPlaying() : null;
      return { ok: true as const, nowPlaying: np };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message, nowPlaying: null };
    }
  });
