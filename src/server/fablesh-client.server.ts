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

export type FablesPagination = {
  limit: number;
  offset: number;
  total: number | null;
};

export type FableshTrack = {
  id: string;
  title: string;
  artist_id: string;
  album_id?: string | null;
  isrc?: string | null;
  duration_seconds?: number | null;
  explicit: boolean;
  media_type: string;
  artwork_url?: string | null;
  audio_url?: string | null;
  approved_at?: string | null;
  description?: string | null;
  artist?: { id: string; name: string } | null;
  album?: { id: string; title: string } | null;
};

export type FableshArtist = {
  id: string;
  name: string;
  bio?: string | null;
  avatar_url?: string | null;
};

export type FableshAlbum = {
  id: string;
  title: string;
  artist_id: string;
  genre?: string | null;
  artwork_url?: string | null;
  release_date?: string | null;
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

type PaginatedEnvelope<T> = { data: T[]; pagination: FablesPagination };

async function callPaginated<T>(
  opts: FableshClientOptions,
  path: string,
  query: { limit?: number; offset?: number } = {},
): Promise<PaginatedEnvelope<T>> {
  const token = readToken(opts.authSecretName);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "RadioCore-MediaSync/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  const url = joinUrl(opts.baseUrl, path) + (qs ? `?${qs}` : "");

  const res = await fetch(url, { headers, signal: opts.signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fablesh ${path} failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as PaginatedEnvelope<T>;
}

/** Fetches every page of a Fablesh list endpoint. Catalogs are small enough to page through in full on each sync. */
async function listAllPages<T>(
  opts: FableshClientOptions,
  path: string,
  pageSize = 100,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await callPaginated<T>(opts, path, { limit: pageSize, offset });
    items.push(...page.data);
    if (page.data.length < pageSize) break;
    offset += pageSize;
  }
  return items;
}

export async function listFableshTracks(opts: FableshClientOptions): Promise<FableshTrack[]> {
  return listAllPages<FableshTrack>(opts, "/api/public/tracks");
}

export async function listFableshArtists(opts: FableshClientOptions): Promise<FableshArtist[]> {
  return listAllPages<FableshArtist>(opts, "/api/public/artists");
}

export async function listFableshAlbums(opts: FableshClientOptions): Promise<FableshAlbum[]> {
  return listAllPages<FableshAlbum>(opts, "/api/public/albums");
}

/** Streaming endpoint redirects to a short-lived signed URL — pass through verbatim, don't cache. */
export function buildFableshStreamUrl(opts: FableshClientOptions, trackId: string): string {
  return joinUrl(opts.baseUrl, `/api/public/stream/${encodeURIComponent(trackId)}`);
}
