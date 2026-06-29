/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @legacy AzuraCast runtime control server functions
 *
 * STATUS: Do not import in new code. No new functions should be added here.
 * PLAN:   Remove when azuracast_connections table and azuracast.tsx UI are retired.
 * SEE:    docs/architecture/radio-core-v2.md §3 — AzuraCast phase-out plan
 *
 * Server fns for AzuraCast runtime control (skip, queue, restart, status, listeners).
 * Client-importable. Calls AzuraCast directly (best-effort) instead of going through sync_jobs,
 * because these are interactive actions where the user wants immediate feedback.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildAzuracastClient,
  type AzuracastConnectionRow,
  AzuracastError,
} from "@/server/azuracast-client.server";

async function requireRole(
  context: { supabase: any; userId: string | null },
  allowed: ("admin" | "editor")[],
) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const ok = (roles ?? []).some((r: { role: string }) => (allowed as string[]).includes(r.role));
  if (!ok) throw new Response("Forbidden", { status: 403 });
}

async function clientFor(stationId: string) {
  const { data, error } = await supabaseAdmin
    .from("azuracast_connections")
    .select("id,station_id,base_url,azuracast_station_id,api_key_secret_name")
    .eq("station_id", stationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No AzuraCast connection for this station");
  return buildAzuracastClient(data as AzuracastConnectionRow);
}

const stationInput = z.object({ station_id: z.string().uuid() });

function wrapErr(e: unknown) {
  if (e instanceof AzuracastError) {
    return new Error(`${e.message} :: ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

export const azuracastGetStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => stationInput.parse(i))
  .handler(async ({ data, context }) => {
    try {
      await requireRole(context, ["admin", "editor"]);
      const c = await clientFor(data.station_id);
      const status = await c.getStationStatus();
      return { ok: true as const, status: status as any };
    } catch (e) {
      throw wrapErr(e);
    }
  });

export const azuracastGetQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => stationInput.parse(i))
  .handler(async ({ data, context }) => {
    try {
      await requireRole(context, ["admin", "editor"]);
      const c = await clientFor(data.station_id);
      const queue = await c.getQueue();
      return { ok: true as const, queue: (queue ?? []) as any[] };
    } catch (e) {
      throw wrapErr(e);
    }
  });

export const azuracastGetListeners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => stationInput.parse(i))
  .handler(async ({ data, context }) => {
    try {
      await requireRole(context, ["admin", "editor"]);
      const c = await clientFor(data.station_id);
      const listeners = await c.getListeners();
      return { ok: true as const, listeners: (listeners ?? []) as any[] };
    } catch (e) {
      throw wrapErr(e);
    }
  });

export const azuracastSkipSong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => stationInput.parse(i))
  .handler(async ({ data, context }) => {
    try {
      await requireRole(context, ["admin"]);
      const c = await clientFor(data.station_id);
      return { ok: true as const, result: (await c.skipSong()) as any };
    } catch (e) { throw wrapErr(e); }
  });

export const azuracastClearQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => stationInput.parse(i))
  .handler(async ({ data, context }) => {
    try {
      await requireRole(context, ["admin"]);
      const c = await clientFor(data.station_id);
      return { ok: true as const, result: (await c.clearQueue()) as any };
    } catch (e) { throw wrapErr(e); }
  });

export const azuracastDeleteQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ station_id: z.string().uuid(), queue_id: z.union([z.string(), z.number()]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    try {
      await requireRole(context, ["admin"]);
      const c = await clientFor(data.station_id);
      return { ok: true as const, result: (await c.deleteQueueItem(data.queue_id)) as any };
    } catch (e) { throw wrapErr(e); }
  });

const actionInput = z.object({
  station_id: z.string().uuid(),
  action: z.enum([
    "restart_station",
    "frontend_start", "frontend_stop", "frontend_restart",
    "backend_start", "backend_stop", "backend_restart",
    "backend_disconnect",
  ]),
});

export const azuracastRuntimeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => actionInput.parse(i))
  .handler(async ({ data, context }) => {
    try {
      await requireRole(context, ["admin"]);
      const c = await clientFor(data.station_id);
      let result: any = null;
      switch (data.action) {
        case "restart_station": result = (await c.restartStation()) as any; break;
        case "frontend_start": result = (await c.startBroadcasting()) as any; break;
        case "frontend_stop": result = (await c.stopBroadcasting()) as any; break;
        case "frontend_restart": result = (await c.restartBroadcasting()) as any; break;
        case "backend_start": result = (await c.startBackend()) as any; break;
        case "backend_stop": result = (await c.stopBackend()) as any; break;
        case "backend_restart": result = (await c.restartBackend()) as any; break;
        case "backend_disconnect": result = (await c.backendDisconnect()) as any; break;
      }
      return { ok: true as const, result };
    } catch (e) { throw wrapErr(e); }
  });
