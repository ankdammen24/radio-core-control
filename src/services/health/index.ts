import { apiClient } from "@/lib/api";

export interface BackendHealth {
  available: boolean;
  checkedAt: string;
  latencyMs: number;
  message: string;
  dependencies?: { mongodb?: { ok: boolean; latency_ms?: number; error?: string } };
}

interface HealthResponse {
  ok: boolean;
  service: string;
  dependencies?: BackendHealth["dependencies"];
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  const startedAt = Date.now();
  const response = await apiClient.get<HealthResponse>("/api/health", { cache: "no-store" });
  const latencyMs = Date.now() - startedAt;
  return {
    available: response.status >= 200 && response.status < 300,
    checkedAt: new Date().toISOString(),
    latencyMs,
    message: response.error ?? "Radio Core API is available",
    dependencies: response.data?.dependencies,
  };
}
