import { apiClient } from "@/lib/api";

export type MediaSourceKind = "fablesh" | "rss";
export type MediaSourceContentType = "music" | "podcast";

export interface ApiMediaSource {
  id: string;
  name: string;
  kind: MediaSourceKind;
  contentType: MediaSourceContentType;
  baseUrl: string;
  authSecretName: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaSourceInput {
  name: string;
  baseUrl: string;
  contentType: MediaSourceContentType;
  kind?: MediaSourceKind;
  authSecretName?: string;
}

export type UpdateMediaSourceInput = Partial<Pick<ApiMediaSource, "name" | "baseUrl" | "authSecretName" | "isActive">>;

export interface ApiSyncRun {
  id: string;
  sourceId: string;
  status: "running" | "success" | "partial" | "error";
  startedAt: string;
  finishedAt: string | null;
  itemsSeen: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsDeleted: number;
  error: string | null;
}

export interface SyncResult {
  source_id: string;
  items_seen: number;
  items_new: number;
  items_updated: number;
  items_deleted: number;
  errors: string[];
  status: "success" | "partial" | "error";
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

export async function listMediaSources(): Promise<ApiMediaSource[]> {
  const response = await apiClient.get<SuccessEnvelope<ApiMediaSource[]> | ErrorEnvelope>("/api/v1/media-sources");
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to list media sources");
}

export async function createMediaSource(input: CreateMediaSourceInput): Promise<ApiMediaSource> {
  const response = await apiClient.post<SuccessEnvelope<ApiMediaSource> | ErrorEnvelope>(
    "/api/v1/media-sources",
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to create media source");
}

export async function updateMediaSource(id: string, input: UpdateMediaSourceInput): Promise<ApiMediaSource> {
  const response = await apiClient.patch<SuccessEnvelope<ApiMediaSource> | ErrorEnvelope>(
    `/api/v1/media-sources/${encodeURIComponent(id)}`,
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to update media source");
}

export async function deleteMediaSource(id: string): Promise<void> {
  const response = await apiClient.delete<void>(`/api/v1/media-sources/${encodeURIComponent(id)}`);
  if (response.error) throw new Error(response.error);
}

export async function triggerMediaSourceSync(id: string): Promise<SyncResult> {
  const response = await apiClient.post<SuccessEnvelope<SyncResult> | ErrorEnvelope>(
    `/api/v1/media-sources/${encodeURIComponent(id)}/sync`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to sync media source");
}

export async function listMediaSourceSyncRuns(id: string): Promise<ApiSyncRun[]> {
  const response = await apiClient.get<SuccessEnvelope<ApiSyncRun[]> | ErrorEnvelope>(
    `/api/v1/media-sources/${encodeURIComponent(id)}/sync-runs`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to list sync runs");
}
