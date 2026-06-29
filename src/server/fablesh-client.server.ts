/**
 * Fablesh public REST client. Server-only.
 *
 * Talks to a Fablesh instance over HTTPS. The public catalog endpoints
 * (`/api/public/podcasts`, `/api/public/podcasts/{id}/episodes`) do not
 * require authentication, but a Bearer token may be attached when configured
 * via `authSecretName` for future private endpoints.
 */

export type FableshPodcast = {
  id: string;
  slug?: string | null;
  title: string;
  subtitle?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  author?: string | null;
  language?: string | null;
  country?: string | null;
  website_url?: string | null;
  artwork_url?: string | null;
  primary_category?: string | null;
  primary_subcategory?: string | null;
  keywords?: string[] | null;
  podcast_type?: string | null;
  explicit?: boolean | null;
  total_episodes?: number | null;
  feed_last_build_at?: string | null;
};

export type FableshEpisode = {
  id: string;
  podcast_id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  shownotes?: string | null;
  season?: number | null;
  episode_number?: number | null;
  episode_type?: string | null;
  duration_seconds?: number | null;
  explicit?: boolean | null;
  published_at?: string | null;
  audio_url: string;
  audio_mime?: string | null;
  audio_size_bytes?: number | null;
  artwork_url?: string | null;
  chapters_url?: string | null;
  transcript_url?: string | null;
  waveform_url?: string | null;
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

type Envelope<T> = { data: T[] } | T[];

async function call<T>(opts: FableshClientOptions, path: string): Promise<T[]> {
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
    throw new Error(
      `Fablesh ${path} failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as Envelope<T>;
  return Array.isArray(json) ? json : json.data ?? [];
}

export async function listFableshPodcasts(
  opts: FableshClientOptions,
): Promise<FableshPodcast[]> {
  return call<FableshPodcast>(opts, "/api/public/podcasts");
}

export async function listFableshEpisodes(
  opts: FableshClientOptions,
  podcastId: string,
): Promise<FableshEpisode[]> {
  return call<FableshEpisode>(
    opts,
    `/api/public/podcasts/${encodeURIComponent(podcastId)}/episodes`,
  );
}
