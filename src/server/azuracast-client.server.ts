/**
 * @legacy AzuraCast REST API client (server-only)
 *
 * STATUS: Do not import in new code.
 * PLAN:   Remove when azuracast-runtime.functions.ts and runtime-adapters/azuracast.ts are removed.
 * SEE:    docs/architecture/radio-core-v2.md §3 — AzuraCast phase-out plan
 *
 * Wraps the Azuracast public + admin API surface used by Radio Core.
 * Docs: https://www.azuracast.com/docs/developers/apis/
 */
import { readEnv } from "@/server/env.server";

export interface AzuracastConnectionConfig {
  baseUrl: string;
  apiKey: string;
  stationId: string | number;
}

export class AzuracastError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Json = unknown;
type QueryValue = string | number | boolean | undefined | null;

function buildUrl(base: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export class AzuracastClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly stationId: string;

  constructor(config: AzuracastConnectionConfig) {
    this.baseUrl = `${config.baseUrl.replace(/\/$/, "")}/api`;
    this.apiKey = config.apiKey;
    this.stationId = String(config.stationId);
  }

  // ---------- low-level ----------
  async request<T = Json>(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown; raw?: boolean } = {},
  ): Promise<T> {
    const url = buildUrl(this.baseUrl, path, options.query);
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      Accept: "application/json",
    };
    let body: BodyInit | undefined;
    if (options.body !== undefined && options.body !== null) {
      if (isFormData) {
        body = options.body as FormData;
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
      }
    }
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    let parsed: unknown = text;
    if (text && (res.headers.get("content-type") ?? "").includes("application/json")) {
      try { parsed = JSON.parse(text); } catch { /* keep text */ }
    }
    if (!res.ok) {
      throw new AzuracastError(
        `Azuracast ${method} ${path} -> ${res.status}`,
        res.status,
        parsed,
      );
    }
    return parsed as T;
  }

  private s(path: string): string {
    return `station/${this.stationId}/${path.replace(/^\//, "")}`;
  }

  // ============================================================
  // System / admin
  // ============================================================
  async ping() { return this.request<unknown>("GET", "frontend/icecast/version"); }
  async serverStatus() { return this.request<unknown>("GET", "admin/server/stats"); }
  async getSettings() { return this.request<unknown>("GET", "admin/settings"); }
  async updateSettings(body: Record<string, unknown>) { return this.request<unknown>("PUT", "admin/settings", { body }); }
  async listAdminUsers() { return this.request<unknown[]>("GET", "admin/users"); }
  async createAdminUser(body: Record<string, unknown>) { return this.request<unknown>("POST", "admin/users", { body }); }
  async updateAdminUser(id: number | string, body: Record<string, unknown>) { return this.request<unknown>("PUT", `admin/user/${id}`, { body }); }
  async deleteAdminUser(id: number | string) { return this.request<unknown>("DELETE", `admin/user/${id}`); }
  async listAdminRoles() { return this.request<unknown[]>("GET", "admin/roles"); }
  async listAdminStorageLocations() { return this.request<unknown[]>("GET", "admin/storage_locations"); }
  async listAdminStations() { return this.request<unknown[]>("GET", "admin/stations"); }
  async listBackups() { return this.request<unknown[]>("GET", "admin/backups"); }
  async runBackup(body?: Record<string, unknown>) { return this.request<unknown>("POST", "admin/backups/run", { body: body ?? {} }); }
  async listApiKeys() { return this.request<unknown[]>("GET", "frontend/account/api-keys"); }

  // ============================================================
  // Now playing / public
  // ============================================================
  async nowPlaying() { return this.request<unknown>("GET", `nowplaying/${this.stationId}`); }
  async nowPlayingAll() { return this.request<unknown[]>("GET", "nowplaying"); }
  async stationPublic() { return this.request<unknown>("GET", `station/${this.stationId}`); }

  // ============================================================
  // Station runtime control
  // ============================================================
  async restartStation() { return this.request<unknown>("POST", this.s("restart")); }
  async startBroadcasting() { return this.request<unknown>("POST", this.s("frontend/start")); }
  async stopBroadcasting() { return this.request<unknown>("POST", this.s("frontend/stop")); }
  async restartBroadcasting() { return this.request<unknown>("POST", this.s("frontend/restart")); }
  async startBackend() { return this.request<unknown>("POST", this.s("backend/start")); }
  async stopBackend() { return this.request<unknown>("POST", this.s("backend/stop")); }
  async restartBackend() { return this.request<unknown>("POST", this.s("backend/restart")); }
  async skipSong() { return this.request<unknown>("POST", this.s("backend/skip")); }
  async backendDisconnect() { return this.request<unknown>("POST", this.s("backend/disconnect")); }
  async getQueue() { return this.request<unknown[]>("GET", this.s("queue")); }
  async clearQueue() { return this.request<unknown>("DELETE", this.s("queue")); }
  async deleteQueueItem(id: number | string) { return this.request<unknown>("DELETE", this.s(`queue/${id}`)); }
  async getHistory(query?: { start?: string; end?: string }) { return this.request<unknown[]>("GET", this.s("history"), { query }); }

  // ============================================================
  // Listeners & analytics
  // ============================================================
  async getListeners() { return this.request<unknown[]>("GET", this.s("listeners")); }
  async getStationStatus() { return this.request<unknown>("GET", this.s("status")); }
  async getReportsOverview() { return this.request<unknown>("GET", this.s("reports/overview/charts")); }
  async getReportsListeners() { return this.request<unknown>("GET", this.s("reports/overview/best-and-worst")); }

  // ============================================================
  // Media library
  // ============================================================
  async listMedia(query?: { searchPhrase?: string; currentPage?: number; rowCount?: number; sortField?: string; sortOrder?: string }) {
    return this.request<{ rows: unknown[]; total?: number } | unknown[]>("GET", this.s("files/list"), { query });
  }
  async getMedia(id: number | string) { return this.request<unknown>("GET", this.s(`file/${id}`)); }
  async createMediaFromUrl(body: { url: string; path?: string }) { return this.request<unknown>("POST", this.s("files"), { body }); }
  async uploadMedia(body: { path: string; file: string /* base64 */ }) { return this.request<unknown>("POST", this.s("files"), { body }); }
  async updateMedia(id: number | string, body: Record<string, unknown>) { return this.request<unknown>("PUT", this.s(`file/${id}`), { body }); }
  async deleteMedia(id: number | string) { return this.request<unknown>("DELETE", this.s(`file/${id}`)); }
  async batchMedia(body: { do: string; files?: string[]; dirs?: string[]; playlists?: number[] }) {
    return this.request<unknown>("PUT", this.s("files/batch"), { body });
  }
  async getMediaArt(id: number | string) { return this.request<unknown>("GET", this.s(`art/${id}`)); }
  async setMediaArt(id: number | string, body: { art: string /* base64 */ }) { return this.request<unknown>("POST", this.s(`art/${id}`), { body }); }

  /** Download the raw audio bytes for a media file by its AzuraCast path. */
  async downloadFileByPath(path: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const url = buildUrl(this.baseUrl, this.s("files/download"), { file: path });
    const res = await fetch(url, { method: "GET", headers: { "X-API-Key": this.apiKey } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AzuracastError(`Azuracast GET files/download -> ${res.status}`, res.status, text);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return { bytes: buf, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }

  // ============================================================
  // Playlists
  // ============================================================
  async listPlaylists() { return this.request<unknown[]>("GET", this.s("playlists")); }
  async getPlaylist(id: number | string) { return this.request<unknown>("GET", this.s(`playlist/${id}`)); }
  async createPlaylist(body: Record<string, unknown>) { return this.request<unknown>("POST", this.s("playlists"), { body }); }
  async updatePlaylist(id: number | string, body: Record<string, unknown>) { return this.request<unknown>("PUT", this.s(`playlist/${id}`), { body }); }
  async deletePlaylist(id: number | string) { return this.request<unknown>("DELETE", this.s(`playlist/${id}`)); }
  async reshufflePlaylist(id: number | string) { return this.request<unknown>("PUT", this.s(`playlist/${id}/reshuffle`)); }
  async clonePlaylist(id: number | string, body?: Record<string, unknown>) { return this.request<unknown>("POST", this.s(`playlist/${id}/clone`), { body: body ?? {} }); }
  async importPlaylist(id: number | string, body: { playlist_file: string }) { return this.request<unknown>("POST", this.s(`playlist/${id}/import`), { body }); }
  async listPlaylistOrder(id: number | string) { return this.request<unknown[]>("GET", this.s(`playlist/${id}/order`)); }
  async setPlaylistOrder(id: number | string, body: { order: Array<number | string> }) { return this.request<unknown>("PUT", this.s(`playlist/${id}/order`), { body }); }

  // ============================================================
  // Streamers (DJs)
  // ============================================================
  async listStreamers() { return this.request<unknown[]>("GET", this.s("streamers")); }
  async getStreamer(id: number | string) { return this.request<unknown>("GET", this.s(`streamer/${id}`)); }
  async createStreamer(body: Record<string, unknown>) { return this.request<unknown>("POST", this.s("streamers"), { body }); }
  async updateStreamer(id: number | string, body: Record<string, unknown>) { return this.request<unknown>("PUT", this.s(`streamer/${id}`), { body }); }
  async deleteStreamer(id: number | string) { return this.request<unknown>("DELETE", this.s(`streamer/${id}`)); }
  async listStreamerBroadcasts(id: number | string) { return this.request<unknown[]>("GET", this.s(`streamer/${id}/broadcasts`)); }

  // ============================================================
  // Mountpoints
  // ============================================================
  async listMountpoints() { return this.request<unknown[]>("GET", this.s("mounts")); }
  async getMountpoint(id: number | string) { return this.request<unknown>("GET", this.s(`mount/${id}`)); }
  async createMountpoint(body: Record<string, unknown>) { return this.request<unknown>("POST", this.s("mounts"), { body }); }
  async updateMountpoint(id: number | string, body: Record<string, unknown>) { return this.request<unknown>("PUT", this.s(`mount/${id}`), { body }); }
  async deleteMountpoint(id: number | string) { return this.request<unknown>("DELETE", this.s(`mount/${id}`)); }

  // ============================================================
  // Remote relays
  // ============================================================
  async listRemotes() { return this.request<unknown[]>("GET", this.s("remotes")); }
  async getRemote(id: number | string) { return this.request<unknown>("GET", this.s(`remote/${id}`)); }
  async createRemote(body: Record<string, unknown>) { return this.request<unknown>("POST", this.s("remotes"), { body }); }
  async updateRemote(id: number | string, body: Record<string, unknown>) { return this.request<unknown>("PUT", this.s(`remote/${id}`), { body }); }
  async deleteRemote(id: number | string) { return this.request<unknown>("DELETE", this.s(`remote/${id}`)); }

  // ============================================================
  // Webhooks
  // ============================================================
  async listWebhooks() { return this.request<unknown[]>("GET", this.s("webhooks")); }
  async getWebhook(id: number | string) { return this.request<unknown>("GET", this.s(`webhook/${id}`)); }
  async createWebhook(body: Record<string, unknown>) { return this.request<unknown>("POST", this.s("webhooks"), { body }); }
  async updateWebhook(id: number | string, body: Record<string, unknown>) { return this.request<unknown>("PUT", this.s(`webhook/${id}`), { body }); }
  async deleteWebhook(id: number | string) { return this.request<unknown>("DELETE", this.s(`webhook/${id}`)); }
  async toggleWebhook(id: number | string) { return this.request<unknown>("PUT", this.s(`webhook/${id}/toggle`)); }
  async testWebhook(id: number | string) { return this.request<unknown>("PUT", this.s(`webhook/${id}/test`)); }

  // ============================================================
  // Podcasts
  // ============================================================
  async listPodcasts() { return this.request<unknown[]>("GET", this.s("podcasts")); }
  async getPodcast(id: string) { return this.request<unknown>("GET", this.s(`podcast/${id}`)); }
  async createPodcast(body: Record<string, unknown>) { return this.request<unknown>("POST", this.s("podcasts"), { body }); }
  async updatePodcast(id: string, body: Record<string, unknown>) { return this.request<unknown>("PUT", this.s(`podcast/${id}`), { body }); }
  async deletePodcast(id: string) { return this.request<unknown>("DELETE", this.s(`podcast/${id}`)); }
  async listPodcastEpisodes(podcastId: string) { return this.request<unknown[]>("GET", this.s(`podcast/${podcastId}/episodes`)); }
  async getPodcastEpisode(podcastId: string, episodeId: string) { return this.request<unknown>("GET", this.s(`podcast/${podcastId}/episode/${episodeId}`)); }
  async createPodcastEpisode(podcastId: string, body: Record<string, unknown>) { return this.request<unknown>("POST", this.s(`podcast/${podcastId}/episodes`), { body }); }
  async updatePodcastEpisode(podcastId: string, episodeId: string, body: Record<string, unknown>) { return this.request<unknown>("PUT", this.s(`podcast/${podcastId}/episode/${episodeId}`), { body }); }
  async deletePodcastEpisode(podcastId: string, episodeId: string) { return this.request<unknown>("DELETE", this.s(`podcast/${podcastId}/episode/${episodeId}`)); }

  // ============================================================
  // Song requests
  // ============================================================
  async listRequests() { return this.request<unknown[]>("GET", this.s("requests")); }
  async listPendingRequests() { return this.request<unknown[]>("GET", this.s("requests/pending")); }
  async clearRequest(id: number | string) { return this.request<unknown>("DELETE", this.s(`request/${id}`)); }

  // ============================================================
  // Custom fields (admin)
  // ============================================================
  async listCustomFields() { return this.request<unknown[]>("GET", "admin/custom_fields"); }
  async createCustomField(body: Record<string, unknown>) { return this.request<unknown>("POST", "admin/custom_fields", { body }); }
  async updateCustomField(id: number | string, body: Record<string, unknown>) { return this.request<unknown>("PUT", `admin/custom_field/${id}`, { body }); }
  async deleteCustomField(id: number | string) { return this.request<unknown>("DELETE", `admin/custom_field/${id}`); }
}

// ---------- factory: build a client from a connection row ----------
export interface AzuracastConnectionRow {
  id: string;
  station_id: string | null;
  base_url: string | null;
  azuracast_station_id: string | null;
  api_key_secret_name: string | null;
}

export function buildAzuracastClient(conn: AzuracastConnectionRow): AzuracastClient {
  if (!conn.base_url || !conn.azuracast_station_id) {
    throw new Error(`Azuracast connection ${conn.id} is missing base_url or azuracast_station_id`);
  }
  const secretName = conn.api_key_secret_name ?? "AZURACAST_API_KEY";
  const apiKey = readEnv(secretName) ?? readEnv("AZURACAST_API_KEY");
  if (!apiKey) {
    throw new Error(`Azuracast API key not found in env (looked for ${secretName})`);
  }
  return new AzuracastClient({
    baseUrl: conn.base_url,
    apiKey,
    stationId: conn.azuracast_station_id,
  });
}
