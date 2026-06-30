import { apiClient } from "@/lib/api";

type SettingsValues = Record<string, unknown>;

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorEnvelope {
  success: false;
  error: { message: string; code: string };
}

function unwrap<T>(payload: SuccessEnvelope<T> | ErrorEnvelope | null, fallbackError: string): T {
  if (payload && payload.success) return payload.data;
  const message = payload && !payload.success ? payload.error.message : fallbackError;
  throw new Error(message);
}

export async function getGlobalSettings(): Promise<SettingsValues> {
  const response = await apiClient.get<SuccessEnvelope<SettingsValues> | ErrorEnvelope>(
    "/api/v1/settings/global",
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to get global settings");
}

export async function updateGlobalSettings(values: SettingsValues): Promise<SettingsValues> {
  const response = await apiClient.patch<SuccessEnvelope<SettingsValues> | ErrorEnvelope>(
    "/api/v1/settings/global",
    { values },
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to update global settings");
}

export async function getStationSettings(stationId: string): Promise<SettingsValues> {
  const response = await apiClient.get<SuccessEnvelope<SettingsValues> | ErrorEnvelope>(
    `/api/v1/settings/stations/${encodeURIComponent(stationId)}`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to get station settings");
}

export async function updateStationSettings(
  stationId: string,
  values: SettingsValues,
): Promise<SettingsValues> {
  const response = await apiClient.patch<SuccessEnvelope<SettingsValues> | ErrorEnvelope>(
    `/api/v1/settings/stations/${encodeURIComponent(stationId)}`,
    { values },
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to update station settings");
}
