import { apiClient } from "@/lib/api";

export type MediaStatus = "active" | "archived";

export interface ApiMediaFile {
  _id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  fileUrl: string;
  storageKey: string;
  type: string;
  status: MediaStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMediaInput {
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  fileUrl: string;
  storageKey: string;
  type: string;
  status?: MediaStatus;
}

export type UpdateMediaInput = Partial<CreateMediaInput>;

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

export async function listMedia(): Promise<ApiMediaFile[]> {
  const response = await apiClient.get<SuccessEnvelope<ApiMediaFile[]> | ErrorEnvelope>("/api/v1/media");
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to list media");
}

export async function getMedia(id: string): Promise<ApiMediaFile> {
  const response = await apiClient.get<SuccessEnvelope<ApiMediaFile> | ErrorEnvelope>(
    `/api/v1/media/${encodeURIComponent(id)}`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to get media");
}

export async function registerMedia(input: CreateMediaInput): Promise<ApiMediaFile> {
  const response = await apiClient.post<SuccessEnvelope<ApiMediaFile> | ErrorEnvelope>(
    "/api/v1/media",
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to register media");
}

export async function updateMediaMetadata(id: string, input: UpdateMediaInput): Promise<ApiMediaFile> {
  const response = await apiClient.patch<SuccessEnvelope<ApiMediaFile> | ErrorEnvelope>(
    `/api/v1/media/${encodeURIComponent(id)}`,
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to update media");
}

export async function deleteMedia(id: string): Promise<void> {
  const response = await apiClient.delete<void>(`/api/v1/media/${encodeURIComponent(id)}`);
  if (response.error) throw new Error(response.error);
}
