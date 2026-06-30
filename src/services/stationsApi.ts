import { apiClient } from "@/lib/api";

export interface ApiStation {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  accountId: string | null;
  isActive: boolean;
  demoMode: boolean;
  demoStreamUrl: string | null;
  demoArtworkUrl: string | null;
  azuracastStationId: string | null;
  apiKeyHash: string | null;
  apiKeyPrefix: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStationInput {
  name: string;
  slug: string;
  description?: string;
  accountId?: string;
  azuracastStationId?: string;
}

export interface UpdateStationInput {
  name?: string;
  slug?: string;
  description?: string;
  accountId?: string;
  azuracastStationId?: string;
  isActive?: boolean;
}

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

export async function listStations(): Promise<ApiStation[]> {
  const response = await apiClient.get<SuccessEnvelope<ApiStation[]> | ErrorEnvelope>("/api/v1/stations");
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to list stations");
}

export async function getStation(id: string): Promise<ApiStation> {
  const response = await apiClient.get<SuccessEnvelope<ApiStation> | ErrorEnvelope>(
    `/api/v1/stations/${encodeURIComponent(id)}`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to get station");
}

export async function createStation(input: CreateStationInput): Promise<ApiStation> {
  const response = await apiClient.post<SuccessEnvelope<ApiStation> | ErrorEnvelope>(
    "/api/v1/stations",
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to create station");
}

export async function updateStation(id: string, input: UpdateStationInput): Promise<ApiStation> {
  const response = await apiClient.patch<SuccessEnvelope<ApiStation> | ErrorEnvelope>(
    `/api/v1/stations/${encodeURIComponent(id)}`,
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to update station");
}

export async function deleteStation(id: string): Promise<void> {
  const response = await apiClient.delete<void>(`/api/v1/stations/${encodeURIComponent(id)}`);
  if (response.error) throw new Error(response.error);
}
