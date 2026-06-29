// Server fns for sync-job control. Client-importable.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/services/database/auth-middleware";
import { runSyncWorker } from "@/server/sync-worker.server";

const enqueueSchema = z.object({
  job_type: z.string().min(1).max(100),
  station_id: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  scheduled_for: z.string().datetime().optional(),
});

// Job-type prefixes that perform privileged/destructive runtime actions.
// Editors may NOT enqueue these — admin only.
const ADMIN_ONLY_JOB_PREFIXES = [
  "azuracast.runtime.",
  "icecast.runtime.",
  "liquidsoap.runtime.",
  "stereo_tool.runtime.",
  "agent.dispatch.",
];

function isAdminOnlyJobType(jobType: string): boolean {
  return ADMIN_ONLY_JOB_PREFIXES.some((p) => jobType.startsWith(p));
}

export const enqueueSyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => enqueueSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Server-side role gate: destructive job types require admin, regardless of RLS.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
    const isAdmin = roleSet.has("admin");
    const isEditor = roleSet.has("editor");
    if (!isAdmin && !isEditor) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (isAdminOnlyJobType(data.job_type) && !isAdmin) {
      throw new Response("Forbidden: admin role required for this job type", { status: 403 });
    }

    const { data: row, error } = await supabase
      .from("sync_jobs")
      .insert({
        job_type: data.job_type,
        station_id: data.station_id ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: { ...(data.payload ?? {}), enqueued_by: context.userId } as any,
        scheduled_for: data.scheduled_for ?? new Date().toISOString(),
        status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, job: row };
  });

export const runSyncWorkerOnce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const ok = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "editor");
    if (!ok) throw new Response("Forbidden", { status: 403 });
    return runSyncWorker({ limit: data.limit ?? 10, worker: "manual" });
  });
