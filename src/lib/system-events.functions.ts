// System events server functions. Client-importable.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const levelEnum = z.enum(["info", "warning", "error", "critical"]);

export const listSystemEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        station_id: z.string().uuid().nullable().optional(),
        level: levelEnum.optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("system_events")
      .select("id, station_id, source, level, event_type, message, details, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 25);
    if (data.station_id) q = q.eq("station_id", data.station_id);
    if (data.level) q = q.eq("level", data.level);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { events: rows ?? [] };
  });

export const recordSystemEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        station_id: z.string().uuid().nullable().optional(),
        source: z.string().min(1).max(50).default("web"),
        level: levelEnum.default("info"),
        event_type: z.string().min(1).max(100),
        message: z.string().max(1000).nullable().optional(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("system_events").insert({
      station_id: data.station_id ?? null,
      source: data.source,
      level: data.level,
      event_type: data.event_type,
      message: data.message ?? null,
      details: (data.details ?? {}) as never,
      actor_user_id: context.userId,
    });
    if (error) throw error;
    return { ok: true as const };
  });
