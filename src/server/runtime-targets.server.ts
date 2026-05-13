// Server-only helpers for runtime targets: secret resolution + execution.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildAdapter, type RuntimeTargetConfig } from "@/server/runtime-adapters";

export async function loadRuntimeTarget(targetId: string): Promise<RuntimeTargetConfig> {
  const { data, error } = await supabaseAdmin
    .from("runtime_targets")
    .select("id, station_id, type, name, base_url, api_key_secret_name, external_station_id, metadata")
    .eq("id", targetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Runtime target not found");
  return {
    ...data,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  } as RuntimeTargetConfig;
}

export function resolveSecret(secretName: string | null): string | null {
  if (!secretName) return null;
  const v = process.env[secretName];
  return v && v.length > 0 ? v : null;
}

export async function runHealthCheck(targetId: string, triggeredBy: string | null) {
  const cfg = await loadRuntimeTarget(targetId);
  const apiKey = resolveSecret(cfg.api_key_secret_name);
  const startedAt = new Date();

  // Insert pending health check row first.
  const { data: log, error: logErr } = await supabaseAdmin
    .from("runtime_health_checks")
    .insert({
      target_id: cfg.id,
      station_id: cfg.station_id,
      status: "unknown",
      started_at: startedAt.toISOString(),
      triggered_by: triggeredBy,
    })
    .select()
    .single();
  if (logErr) throw logErr;

  let status: "ok" | "degraded" | "down" | "error" = "error";
  let message = "";
  let details: Record<string, unknown> = {};

  try {
    const adapter = buildAdapter(cfg, apiKey);
    const result = await adapter.testConnection();
    status = result.status === "unknown" ? "error" : result.status;
    message = result.message;
    details = {
      reachable: result.reachable,
      serverInfo: result.serverInfo ?? null,
      nowPlaying: result.nowPlaying ?? null,
    };
  } catch (e) {
    status = "error";
    message = (e as Error).message;
  }

  const finishedAt = new Date();
  const duration = finishedAt.getTime() - startedAt.getTime();

  await supabaseAdmin
    .from("runtime_health_checks")
    .update({
      status,
      finished_at: finishedAt.toISOString(),
      duration_ms: duration,
      error_message: status === "ok" ? null : message,
      details: details as never,
    })
    .eq("id", log.id);

  await supabaseAdmin
    .from("runtime_targets")
    .update({
      status,
      last_checked_at: finishedAt.toISOString(),
      last_error: status === "ok" ? null : message,
    })
    .eq("id", cfg.id);

  // Mirror to sync_jobs for unified ops log.
  await supabaseAdmin.from("sync_jobs").insert({
    job_type: "runtime_health_check",
    station_id: cfg.station_id,
    status: status === "ok" ? "completed" : "failed",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    payload: { target_id: cfg.id, target_name: cfg.name, target_type: cfg.type } as never,
    message: status === "ok" ? null : message,
  });

  return { status, message, duration_ms: duration, log_id: log.id };
}
