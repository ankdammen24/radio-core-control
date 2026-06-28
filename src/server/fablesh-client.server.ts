/**
 * Fablesh REST client. Server-only.
 *
 * Talks to a Fablesh instance over HTTPS using a Bearer token whose value is
 * looked up from process.env using the secret name configured per source.
 */

export type FableshPodcast = {
  PodcastId: string;
  Title: string;
  Description?: string | null;
  Language?: string | null;
  Categories?: string[] | null;
  Artwork?: string | null;
  Owner?: string | null;
  LastUpdated?: string | null;
  Checksum?: string | null;
};

export type FableshEpisode = {
  EpisodeId: string;
  GUID: string;
  Title: string;
  Description?: string | null;
  PublishDate?: string | null;
  Duration?: number | null;
  Explicit?: boolean | null;
  Season?: number | null;
  EpisodeNumber?: number | null;
  AudioUrl: string;
  AudioFormat?: string | null;
  Artwork?: string | null;
  TranscriptAvailable?: boolean | null;
  TranscriptUrl?: string | null;
  Checksum?: string | null;
  Version?: number | null;
};

export type FableshClientOptions = {
  baseUrl: string;
  authSecretName?: string | null;
  signal?: AbortSignal;
};

function readToken(secretName?: string | null): string | null {
  if (!secretName) return null;
  const v = process.env[secretName];
  return v && v.length > 0 ? v : null;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function call<T>(opts: FableshClientOptions, path: string): Promise<T> {
  const token = readToken(opts.authSecretName);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "RadioCore-PodcastHub/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(joinUrl(opts.baseUrl, path), {
    headers,
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fablesh ${path} failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function listFableshPodcasts(opts: FableshClientOptions): Promise<FableshPodcast[]> {
  const data = await call<FableshPodcast[] | { podcasts: FableshPodcast[] }>(opts, "/api/podcasts");
  return Array.isArray(data) ? data : data.podcasts ?? [];
}

export async function listFableshEpisodes(
  opts: FableshClientOptions,
  podcastId: string,
): Promise<FableshEpisode[]> {
  const data = await call<FableshEpisode[] | { episodes: FableshEpisode[] }>(
    opts,
    `/api/podcasts/${encodeURIComponent(podcastId)}/episodes`,
  );
  return Array.isArray(data) ? data : data.episodes ?? [];
}
