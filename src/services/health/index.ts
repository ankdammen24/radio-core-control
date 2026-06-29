import { apiClient } from "@/lib/api";

export interface BackendHealth {
  available: boolean;
  checkedAt: string;
  latencyMs: number;
  message: string;
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  const startedAt = Date.now();
  const response = await apiClient.get<string>("/health", { cache: "no-store" });
  const latencyMs = Date.now() - startedAt;
  return {
    available: response.status >= 200 && response.status < 300,
    checkedAt: new Date().toISOString(),
    latencyMs,
    message:
      response.error ??
      (response.data === "OK" ? "Radio Core API is available" : "Radio Core API responded"),
  };
}
