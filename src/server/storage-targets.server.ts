/**
 * Server-only helpers for storage targets.
 */
import { adminDatabase } from "@/services/database/server";
import { buildStorageAdapter } from "./storage-adapters";
import type { StorageTargetConfig, TestResult } from "./storage-adapters/types";

export async function loadStorageTarget(id: string): Promise<StorageTargetConfig> {
  const { data, error } = await adminDatabase
    .from("storage_targets")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message || "Storage target not found");
  return data as unknown as StorageTargetConfig;
}

export async function runStorageHealthCheck(
  targetId: string,
  triggeredBy: string | null,
): Promise<TestResult & { target_id: string }> {
  const cfg = await loadStorageTarget(targetId);
  const adapter = buildStorageAdapter(cfg);

  const startedAt = new Date().toISOString();
  const result = await adapter.testConnection();
  const finishedAt = new Date().toISOString();

  // Persist health-check row
  await adminDatabase.from("storage_health_checks").insert({
    target_id: cfg.id,
    station_id: cfg.station_id,
    status: result.status,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: result.duration_ms,
    error_message: result.status === "online" ? null : result.message,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details: (result.details ?? {}) as any,
    triggered_by: triggeredBy,
  });

  // Update target row
  await adminDatabase
    .from("storage_targets")
    .update({
      status: result.status,
      last_checked_at: finishedAt,
      last_error: result.status === "online" ? null : result.message,
    })
    .eq("id", cfg.id);

  // Mirror into sync_jobs as a storage_check entry for the operations log.
  try {
    await adminDatabase.from("sync_jobs").insert({
      job_type: "storage_check",
      station_id: cfg.station_id,
      status: result.status === "online" ? "completed" : "failed",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { storage_target_id: cfg.id, provider: cfg.provider, purpose: cfg.purpose } as any,
      started_at: startedAt,
      finished_at: finishedAt,
      message: result.status === "online" ? null : result.message,
    });
  } catch {
    // sync_jobs schema may differ across deployments; do not block health check.
  }

  // Mirror into service_health for the Health page summary.
  try {
    await adminDatabase.from("service_health").insert({
      station_id: cfg.station_id,
      service: `storage:${cfg.provider}`,
      status: result.status,
      message: result.message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details: { target_id: cfg.id, name: cfg.name, purpose: cfg.purpose } as any,
    });
  } catch {
    // best-effort
  }

  return { ...result, target_id: cfg.id };
}
