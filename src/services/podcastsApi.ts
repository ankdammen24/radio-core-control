import { apiClient } from "@/lib/api";

export interface ApiPodcast {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  imageUrl: string | null;
  rssUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePodcastInput {
  title: string;
  description?: string;
  author?: string;
  imageUrl?: string;
  rssUrl?: string;
  status?: string;
}

export type UpdatePodcastInput = Partial<CreatePodcastInput>;

export interface ApiEpisode {
  id: string;
  podcastId: string;
  title: string;
  description: string | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEpisodeInput {
  title: string;
  description?: string;
  audioUrl?: string;
  durationSeconds?: number;
  publishedAt?: string;
  status?: string;
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

export async function listPodcasts(): Promise<ApiPodcast[]> {
  const response = await apiClient.get<SuccessEnvelope<ApiPodcast[]> | ErrorEnvelope>("/api/v1/podcasts");
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to list podcasts");
}

export async function getPodcast(id: string): Promise<ApiPodcast> {
  const response = await apiClient.get<SuccessEnvelope<ApiPodcast> | ErrorEnvelope>(
    `/api/v1/podcasts/${encodeURIComponent(id)}`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to get podcast");
}

export async function createPodcast(input: CreatePodcastInput): Promise<ApiPodcast> {
  const response = await apiClient.post<SuccessEnvelope<ApiPodcast> | ErrorEnvelope>(
    "/api/v1/podcasts",
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to create podcast");
}

export async function updatePodcast(id: string, input: UpdatePodcastInput): Promise<ApiPodcast> {
  const response = await apiClient.patch<SuccessEnvelope<ApiPodcast> | ErrorEnvelope>(
    `/api/v1/podcasts/${encodeURIComponent(id)}`,
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to update podcast");
}

export async function listEpisodes(podcastId: string): Promise<ApiEpisode[]> {
  const response = await apiClient.get<SuccessEnvelope<ApiEpisode[]> | ErrorEnvelope>(
    `/api/v1/podcasts/${encodeURIComponent(podcastId)}/episodes`,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to list episodes");
}

export async function createEpisode(podcastId: string, input: CreateEpisodeInput): Promise<ApiEpisode> {
  const response = await apiClient.post<SuccessEnvelope<ApiEpisode> | ErrorEnvelope>(
    `/api/v1/podcasts/${encodeURIComponent(podcastId)}/episodes`,
    input,
  );
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, "Failed to create episode");
}
