import { apiClient } from "@/lib/api";

export interface ApiIcecastConfig {
  id: string;
  stationId: string;
  hostname: string;
  port: number;
  sourcePassword: string;
  relayPassword: string;
  adminUser: string;
  adminPassword: string;
  adminEmail: string | null;
  location: string | null;
  maxClients: number;
  maxSources: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiLiquidsoapConfig {
  id: string;
  stationId: string;
  telnetHost: string;
  telnetPort: number;
  crossfadeSeconds: number;
  normalizeAudio: boolean;
  fallbackTrackPath: string | null;
  customLiq: string | null;
  generatedLiq: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiStreamMount {
  id: string;
  stationId: string;
  mountPath: string;
  format: string;
  bitrate: number;
  isDefault: boolean;
  isActive: boolean;
  sourcePassword: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiLiveInput {
  id: string;
  stationId: string;
  mountPath: string;
  harborPort: number;
  sourceUser: string;
  sourcePassword: string;
  format: string;
  bitrate: number;
  isEnabled: boolean;
  isLive: boolean;
  autoTakeover: boolean;
  forcedTakeover: boolean;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  notes: string | null;
  lastStateChange: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiFallbackTrack {
  id: string;
  stationId: string;
  label: string;
  externalUrl: string | null;
  mediaFileId: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiStreamingOutput {
  id: string;
  stationId: string;
  name: string;
  type: string;
  host: string;
  port: number;
  mountpoint: string | null;
  username: string | null;
  password: string | null;
  format: string;
  bitrate: number;
  codec: string;
  sampleRate: number;
  channels: number;
  isEnabled: boolean;
  isPublic: boolean;
  useTls: boolean;
  priority: number;
  healthStatus: string;
  createdAt: string;
  updatedAt: string;
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

async function get<T>(path: string, fallbackError: string): Promise<T> {
  const response = await apiClient.get<SuccessEnvelope<T> | ErrorEnvelope>(path);
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, fallbackError);
}

async function post<T>(path: string, body: unknown, fallbackError: string): Promise<T> {
  const response = await apiClient.post<SuccessEnvelope<T> | ErrorEnvelope>(path, body);
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, fallbackError);
}

async function patch<T>(path: string, body: unknown, fallbackError: string): Promise<T> {
  const response = await apiClient.patch<SuccessEnvelope<T> | ErrorEnvelope>(path, body);
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, fallbackError);
}

async function put<T>(path: string, body: unknown, fallbackError: string): Promise<T> {
  const response = await apiClient.put<SuccessEnvelope<T> | ErrorEnvelope>(path, body);
  if (response.error) throw new Error(response.error);
  return unwrap(response.data, fallbackError);
}

async function del(path: string): Promise<void> {
  const response = await apiClient.delete<void>(path);
  if (response.error) throw new Error(response.error);
}

// ─── Icecast config ─────────────────────────────────────────────────────────
export const getIcecastConfig = (stationId: string) =>
  get<ApiIcecastConfig | null>(`/api/v1/stations/${encodeURIComponent(stationId)}/icecast-config`, "Failed to get icecast config");

export const saveIcecastConfig = (stationId: string, input: Partial<ApiIcecastConfig>) =>
  put<ApiIcecastConfig>(`/api/v1/stations/${encodeURIComponent(stationId)}/icecast-config`, input, "Failed to save icecast config");

// ─── Liquidsoap config ──────────────────────────────────────────────────────
export const getLiquidsoapConfig = (stationId: string) =>
  get<ApiLiquidsoapConfig | null>(`/api/v1/stations/${encodeURIComponent(stationId)}/liquidsoap-config`, "Failed to get liquidsoap config");

export const saveLiquidsoapConfig = (stationId: string, input: Partial<ApiLiquidsoapConfig>) =>
  put<ApiLiquidsoapConfig>(`/api/v1/stations/${encodeURIComponent(stationId)}/liquidsoap-config`, input, "Failed to save liquidsoap config");

// ─── Stream mounts ──────────────────────────────────────────────────────────
export const listStreamMounts = (stationId: string) =>
  get<ApiStreamMount[]>(`/api/v1/stations/${encodeURIComponent(stationId)}/stream-mounts`, "Failed to list stream mounts");

export const createStreamMount = (stationId: string, input: Partial<ApiStreamMount>) =>
  post<ApiStreamMount>(`/api/v1/stations/${encodeURIComponent(stationId)}/stream-mounts`, input, "Failed to create stream mount");

export const updateStreamMount = (id: string, input: Partial<ApiStreamMount>) =>
  patch<ApiStreamMount>(`/api/v1/stream-mounts/${encodeURIComponent(id)}`, input, "Failed to update stream mount");

export const deleteStreamMount = (id: string) => del(`/api/v1/stream-mounts/${encodeURIComponent(id)}`);

// ─── Live inputs ────────────────────────────────────────────────────────────
export const listLiveInputs = (stationId: string) =>
  get<ApiLiveInput[]>(`/api/v1/stations/${encodeURIComponent(stationId)}/live-inputs`, "Failed to list live inputs");

export const createLiveInput = (stationId: string, input: Partial<ApiLiveInput>) =>
  post<ApiLiveInput>(`/api/v1/stations/${encodeURIComponent(stationId)}/live-inputs`, input, "Failed to create live input");

export const updateLiveInput = (id: string, input: Partial<ApiLiveInput>) =>
  patch<ApiLiveInput>(`/api/v1/live-inputs/${encodeURIComponent(id)}`, input, "Failed to update live input");

export const deleteLiveInput = (id: string) => del(`/api/v1/live-inputs/${encodeURIComponent(id)}`);

// ─── Fallback tracks ────────────────────────────────────────────────────────
export const listFallbackTracks = (stationId: string) =>
  get<ApiFallbackTrack[]>(`/api/v1/stations/${encodeURIComponent(stationId)}/fallback-tracks`, "Failed to list fallback tracks");

export const createFallbackTrack = (stationId: string, input: Partial<ApiFallbackTrack>) =>
  post<ApiFallbackTrack>(`/api/v1/stations/${encodeURIComponent(stationId)}/fallback-tracks`, input, "Failed to create fallback track");

export const updateFallbackTrack = (id: string, input: Partial<ApiFallbackTrack>) =>
  patch<ApiFallbackTrack>(`/api/v1/fallback-tracks/${encodeURIComponent(id)}`, input, "Failed to update fallback track");

export const deleteFallbackTrack = (id: string) => del(`/api/v1/fallback-tracks/${encodeURIComponent(id)}`);

// ─── Streaming outputs ──────────────────────────────────────────────────────
export const listStreamingOutputs = (stationId: string) =>
  get<ApiStreamingOutput[]>(`/api/v1/stations/${encodeURIComponent(stationId)}/streaming-outputs`, "Failed to list streaming outputs");

export const createStreamingOutput = (stationId: string, input: Partial<ApiStreamingOutput>) =>
  post<ApiStreamingOutput>(`/api/v1/stations/${encodeURIComponent(stationId)}/streaming-outputs`, input, "Failed to create streaming output");

export const updateStreamingOutput = (id: string, input: Partial<ApiStreamingOutput>) =>
  patch<ApiStreamingOutput>(`/api/v1/streaming-outputs/${encodeURIComponent(id)}`, input, "Failed to update streaming output");

export const deleteStreamingOutput = (id: string) => del(`/api/v1/streaming-outputs/${encodeURIComponent(id)}`);
