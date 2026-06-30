/**
 * Media sync engine — server-only.
 *
 * Pulls music or podcasts from a configured media_sources row (Fablesh
 * today) and upserts metadata into the Postgres tables (media_files /
 * podcasts+podcast_episodes) via Drizzle. No audio files are stored —
 * stream/audio URLs are passed through verbatim.
 *
 * Replaces the earlier Supabase-based podcast-sync.server.ts, extended to
 * also cover music. Diffing uses checksum where the source row already has
 * one; Fablesh doesn't expose per-item checksums today, so items are always
 * upserted (catalog volumes are small).
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mediaFiles, podcasts, podcastEpisodes } from "@/server/db/schema";
import {
  findMediaSourceById,
  startSyncRun,
  finishSyncRun,
  touchMediaSourceSynced,
} from "@/server/repositories/mediaSources.repository";
import {
  listFableshTracks,
  listFableshArtists,
  listFableshAlbums,
  listFableshPodcasts,
  listFableshEpisodes,
  buildFableshStreamUrl,
  type FableshTrack,
  type FableshArtist,
  type FableshAlbum,
} from "@/server/fablesh-client.server";

export type SyncSummary = {
  source_id: string;
  items_seen: number;
  items_new: number;
  items_updated: number;
  items_deleted: number;
  errors: string[];
  status: "success" | "partial" | "error";
};

async function syncMusicSource(sourceId: string, baseUrl: string, authSecretName: string | null) {
  const opts = { baseUrl, authSecretName };
  const [tracks, artists, albums] = await Promise.all([
    listFableshTracks(opts),
    listFableshArtists(opts),
    listFableshAlbums(opts),
  ]);
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const albumById = new Map(albums.map((a) => [a.id, a]));

  let itemsNew = 0;
  let itemsUpdated = 0;
  const errors: string[] = [];

  for (const track of tracks) {
    try {
      const existing = await db
        .select({ id: mediaFiles.id })
        .from(mediaFiles)
        .where(and(eq(mediaFiles.sourceId, sourceId), eq(mediaFiles.externalId, track.id)))
        .limit(1);

      const mapped = mapTrack(track, sourceId, opts, artistById, albumById);

      if (existing[0]) {
        await db
          .update(mediaFiles)
          .set({ ...mapped, updatedAt: new Date() })
          .where(eq(mediaFiles.id, existing[0].id));
        itemsUpdated++;
      } else {
        await db.insert(mediaFiles).values(mapped);
        itemsNew++;
      }
    } catch (e) {
      errors.push(`track ${track.id}: ${(e as Error).message}`);
    }
  }

  return { itemsSeen: tracks.length, itemsNew, itemsUpdated, itemsDeleted: 0, errors };
}

function mapTrack(
  track: FableshTrack,
  sourceId: string,
  opts: { baseUrl: string; authSecretName: string | null },
  artistById: Map<string, FableshArtist>,
  albumById: Map<string, FableshAlbum>,
) {
  const artistName = track.artist?.name ?? artistById.get(track.artist_id)?.name ?? null;
  const albumTitle = track.album?.title ?? (track.album_id ? albumById.get(track.album_id)?.title : null) ?? null;
  return {
    sourceId,
    externalId: track.id,
    fileName: track.title,
    title: track.title,
    artist: artistName,
    album: albumTitle,
    durationSeconds: track.duration_seconds ?? undefined,
    artworkUrl: track.artwork_url ?? undefined,
    streamUrl: track.audio_url ?? buildFableshStreamUrl(opts, track.id),
    mediaKind: "music",
    status: "ready",
  };
}

async function syncPodcastSource(sourceId: string, baseUrl: string, authSecretName: string | null) {
  const opts = { baseUrl, authSecretName };
  const remotePodcasts = await listFableshPodcasts(opts);

  let itemsSeen = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;
  let itemsDeleted = 0;
  const errors: string[] = [];

  for (const rp of remotePodcasts) {
    try {
      const existingPodcast = await db
        .select({ id: podcasts.id })
        .from(podcasts)
        .where(and(eq(podcasts.sourceId, sourceId), eq(podcasts.externalId, rp.id)))
        .limit(1);

      let podcastId: string;
      const mappedPodcast = {
        sourceId,
        externalId: rp.id,
        title: rp.title,
        description: rp.long_description ?? rp.short_description ?? undefined,
        author: rp.author ?? undefined,
        imageUrl: rp.artwork_url ?? undefined,
        status: "active",
      };

      if (existingPodcast[0]) {
        podcastId = existingPodcast[0].id;
        await db.update(podcasts).set({ ...mappedPodcast, updatedAt: new Date() }).where(eq(podcasts.id, podcastId));
      } else {
        const rows = await db.insert(podcasts).values(mappedPodcast).returning({ id: podcasts.id });
        podcastId = rows[0].id;
      }

      const remoteEpisodes = await listFableshEpisodes(opts, rp.id);
      itemsSeen += 1 + remoteEpisodes.length;
      const remoteGuids = new Set(remoteEpisodes.map((e) => e.id));

      const localEpisodes = await db
        .select({ id: podcastEpisodes.id, guid: podcastEpisodes.guid, deletedAt: podcastEpisodes.deletedAt })
        .from(podcastEpisodes)
        .where(eq(podcastEpisodes.podcastId, podcastId));
      const localByGuid = new Map(localEpisodes.map((e) => [e.guid, e]));

      for (const re of remoteEpisodes) {
        const mappedEpisode = {
          podcastId,
          guid: re.id,
          title: re.title,
          description: re.description ?? undefined,
          audioUrl: re.audio_url,
          durationSeconds: re.duration_seconds ?? undefined,
          publishedAt: re.published_at ? new Date(re.published_at) : undefined,
          status: "published",
        };
        const existingEp = localByGuid.get(re.id);
        if (existingEp) {
          await db
            .update(podcastEpisodes)
            .set({ ...mappedEpisode, updatedAt: new Date() })
            .where(eq(podcastEpisodes.id, existingEp.id));
          itemsUpdated++;
        } else {
          await db.insert(podcastEpisodes).values(mappedEpisode);
          itemsNew++;
        }
      }

      for (const [guid, ep] of localByGuid) {
        if (guid && !remoteGuids.has(guid) && !ep.deletedAt) {
          await db.update(podcastEpisodes).set({ deletedAt: new Date() }).where(eq(podcastEpisodes.id, ep.id));
          itemsDeleted++;
        }
      }
    } catch (e) {
      errors.push(`podcast ${rp.id}: ${(e as Error).message}`);
    }
  }

  return { itemsSeen, itemsNew, itemsUpdated, itemsDeleted, errors };
}

export async function syncMediaSource(sourceId: string): Promise<SyncSummary> {
  const source = await findMediaSourceById(sourceId);
  if (!source) throw new Error("Media source not found");
  if (!source.isActive) {
    return { source_id: sourceId, items_seen: 0, items_new: 0, items_updated: 0, items_deleted: 0, errors: ["source inactive"], status: "error" };
  }
  if (source.kind !== "fablesh") {
    return { source_id: sourceId, items_seen: 0, items_new: 0, items_updated: 0, items_deleted: 0, errors: [`source kind '${source.kind}' is not implemented yet`], status: "error" };
  }

  const run = await startSyncRun(sourceId);

  try {
    const result =
      source.contentType === "music"
        ? await syncMusicSource(sourceId, source.baseUrl, source.authSecretName)
        : await syncPodcastSource(sourceId, source.baseUrl, source.authSecretName);

    const status: SyncSummary["status"] = result.errors.length === 0 ? "success" : "partial";
    await finishSyncRun(run.id, {
      itemsSeen: result.itemsSeen,
      itemsNew: result.itemsNew,
      itemsUpdated: result.itemsUpdated,
      itemsDeleted: result.itemsDeleted,
      status,
      error: result.errors.length ? result.errors.join("\n").slice(0, 4000) : undefined,
    });
    await touchMediaSourceSynced(sourceId);

    return {
      source_id: sourceId,
      items_seen: result.itemsSeen,
      items_new: result.itemsNew,
      items_updated: result.itemsUpdated,
      items_deleted: result.itemsDeleted,
      errors: result.errors,
      status,
    };
  } catch (e) {
    const message = (e as Error).message;
    await finishSyncRun(run.id, { status: "error", error: message.slice(0, 4000) });
    return { source_id: sourceId, items_seen: 0, items_new: 0, items_updated: 0, items_deleted: 0, errors: [message], status: "error" };
  }
}
