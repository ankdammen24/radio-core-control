import { apiClient } from "@/lib/api";

export type PlaylistStatus = "active" | "inactive";

export interface ApiPlaylistItem {
  mediaId: string;
  addedAt: string;
}

export interface ApiPlaylist {
  _id: string;
  name: string;
  description?: string;
  stationId?: string;
  items: ApiPlaylistItem[];
  status: PlaylistStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePlaylistInput {
  name: string;
  description?: string;
  stationId?: string;
  status?: PlaylistStatus;
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

export async function listPlaylists(): Promise<ApiPlaylist[]> {
  const response = await apiClient.get<SuccessEnvelope<ApiPlaylist[]> | ErrorEnvelope>("/api/v1/playlists");
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to list playlists");
}

export async function getPlaylist(id: string): Promise<ApiPlaylist> {
  const response = await apiClient.get<SuccessEnvelope<ApiPlaylist> | ErrorEnvelope>(
    `/api/v1/playlists/${encodeURIComponent(id)}`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to get playlist");
}

export async function createPlaylist(input: CreatePlaylistInput): Promise<ApiPlaylist> {
  const response = await apiClient.post<SuccessEnvelope<ApiPlaylist> | ErrorEnvelope>(
    "/api/v1/playlists",
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to create playlist");
}

export async function addMediaToPlaylist(playlistId: string, mediaId: string): Promise<ApiPlaylist> {
  const response = await apiClient.post<SuccessEnvelope<ApiPlaylist> | ErrorEnvelope>(
    `/api/v1/playlists/${encodeURIComponent(playlistId)}/items`,
    { mediaId },
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to add media to playlist");
}

export async function removeMediaFromPlaylist(playlistId: string, mediaId: string): Promise<ApiPlaylist> {
  const response = await apiClient.delete<SuccessEnvelope<ApiPlaylist> | ErrorEnvelope>(
    `/api/v1/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(mediaId)}`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to remove media from playlist");
}
