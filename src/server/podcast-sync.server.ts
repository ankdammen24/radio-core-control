/**
 * Podcast sync engine — server-only.
 *
 * Pulls podcasts + episodes from a configured source (Fablesh today, RSS later),
 * diffs against the local Radio Core cache via GUID/checksum/version and
 * upserts metadata. No audio files are stored — `audio_url` is assumed to be
 * the Fablesh streaming URL passed through verbatim.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  listFableshPodcasts,
  listFableshEpisodes,
  type FableshPodcast,
  type FableshEpisode,
} from "./fablesh-client.server";

export type SyncSummary = {
  source_id: string;
  podcasts_seen: number;
  episodes_new: number;
  episodes_updated: number;
  episodes_deleted: number;
  errors: string[];
  status: "success" | "partial" | "error";
};

type SourceRow = {
  id: string;
  name: string;
  kind: "fablesh" | "rss";
  base_url: string;
  auth_secret_name: string | null;
  is_active: boolean;
};

function mapPodcast(source_id: string, p: FableshPodcast) {
  return {
    source_id,
    external_id: p.PodcastId,
    title: p.Title,
    description: p.Description ?? null,
    language: p.Language ?? null,
    categories: p.Categories ?? [],
    artwork_url: p.Artwork ?? null,
    owner: p.Owner ?? null,
    last_updated_at: p.LastUpdated ?? null,
    checksum: p.Checksum ?? null,
  };
}

function mapEpisode(podcast_id: string, e: FableshEpisode) {
  return {
    podcast_id,
    guid: e.GUID,
    title: e.Title,
    description: e.Description ?? null,
    publish_date: e.PublishDate ?? null,
    duration_seconds: e.Duration ?? null,
    explicit: !!e.Explicit,
    season: e.Season ?? null,
    episode_number: e.EpisodeNumber ?? null,
    audio_url: e.AudioUrl,
    audio_format: e.AudioFormat ?? null,
    artwork_url: e.Artwork ?? null,
    transcript_url: e.TranscriptUrl ?? null,
    checksum: e.Checksum ?? null,
    version: e.Version ?? 1,
    deleted_at: null as string | null,
  };
}

export async function syncSource(sourceId: string): Promise<SyncSummary> {
  const { data: srcRow, error: srcErr } = await supabaseAdmin
    .from("podcast_sources")
    .select("id, name, kind, base_url, auth_secret_name, is_active")
    .eq("id", sourceId)
    .single();
  if (srcErr || !srcRow) throw new Error(srcErr?.message || "Source not found");
  const src = srcRow as SourceRow;
  if (!src.is_active) {
    return { source_id: src.id, podcasts_seen: 0, episodes_new: 0, episodes_updated: 0, episodes_deleted: 0, errors: ["source inactive"], status: "error" };
  }

  // Open run row
  const { data: runRow } = await supabaseAdmin
    .from("podcast_sync_runs")
    .insert({ source_id: src.id, status: "running" })
    .select("id")
    .single();
  const runId = runRow?.id as string | undefined;

  const errors: string[] = [];
  let podcastsSeen = 0;
  let episodesNew = 0;
  let episodesUpdated = 0;
  let episodesDeleted = 0;

  try {
    if (src.kind !== "fablesh") {
      throw new Error(`Source kind '${src.kind}' is not implemented yet (only 'fablesh').`);
    }

    const remotePodcasts = await listFableshPodcasts({
      baseUrl: src.base_url,
      authSecretName: src.auth_secret_name,
    });
    podcastsSeen = remotePodcasts.length;

    // Index existing local podcasts by external_id for diff
    const { data: localPods } = await supabaseAdmin
      .from("podcasts")
      .select("id, external_id, checksum, last_updated_at")
      .eq("source_id", src.id);
    const localIdx = new Map<string, { id: string; checksum: string | null; last_updated_at: string | null }>();
    for (const lp of (localPods ?? []) as Array<{ id: string; external_id: string; checksum: string | null; last_updated_at: string | null }>) {
      localIdx.set(lp.external_id, { id: lp.id, checksum: lp.checksum, last_updated_at: lp.last_updated_at });
    }

    for (const rp of remotePodcasts) {
      try {
        const mapped = mapPodcast(src.id, rp);
        const existing = localIdx.get(rp.PodcastId);

        let podcastId: string;
        if (!existing) {
          const { data, error } = await supabaseAdmin
            .from("podcasts")
            .insert(mapped)
            .select("id")
            .single();
          if (error) throw error;
          podcastId = data!.id as string;
        } else {
          podcastId = existing.id;
          const changed =
            (mapped.checksum && mapped.checksum !== existing.checksum) ||
            (mapped.last_updated_at && mapped.last_updated_at !== existing.last_updated_at);
          if (changed) {
            const { error } = await supabaseAdmin.from("podcasts").update(mapped).eq("id", podcastId);
            if (error) throw error;
          }
        }

        // Episodes
        const remoteEps = await listFableshEpisodes(
          { baseUrl: src.base_url, authSecretName: src.auth_secret_name },
          rp.PodcastId,
        );
        const remoteGuids = new Set(remoteEps.map((e) => e.GUID));

        const { data: localEps } = await supabaseAdmin
          .from("podcast_episodes")
          .select("id, guid, checksum, version, deleted_at")
          .eq("podcast_id", podcastId);
        const localEpIdx = new Map<string, { id: string; checksum: string | null; version: number; deleted_at: string | null }>();
        for (const le of (localEps ?? []) as Array<{ id: string; guid: string; checksum: string | null; version: number; deleted_at: string | null }>) {
          localEpIdx.set(le.guid, le);
        }

        for (const re of remoteEps) {
          const mappedEp = mapEpisode(podcastId, re);
          const existingEp = localEpIdx.get(re.GUID);
          if (!existingEp) {
            const { error } = await supabaseAdmin.from("podcast_episodes").insert(mappedEp);
            if (error) throw error;
            episodesNew++;
          } else {
            const changed =
              (mappedEp.checksum && mappedEp.checksum !== existingEp.checksum) ||
              mappedEp.version > (existingEp.version ?? 0) ||
              existingEp.deleted_at !== null;
            if (changed) {
              const { error } = await supabaseAdmin
                .from("podcast_episodes")
                .update(mappedEp)
                .eq("id", existingEp.id);
              if (error) throw error;
              episodesUpdated++;
            }
          }
        }

        // Mark removed episodes as deleted (soft)
        for (const [guid, le] of localEpIdx.entries()) {
          if (!remoteGuids.has(guid) && !le.deleted_at) {
            const { error } = await supabaseAdmin
              .from("podcast_episodes")
              .update({ deleted_at: new Date().toISOString() })
              .eq("id", le.id);
            if (error) throw error;
            episodesDeleted++;
          }
        }
      } catch (e) {
        errors.push(`podcast ${rp.PodcastId}: ${(e as Error).message}`);
      }
    }

    await supabaseAdmin
      .from("podcast_sources")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", src.id);

    const status: SyncSummary["status"] = errors.length === 0 ? "success" : "partial";
    if (runId) {
      await supabaseAdmin
        .from("podcast_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          podcasts_seen: podcastsSeen,
          episodes_new: episodesNew,
          episodes_updated: episodesUpdated,
          episodes_deleted: episodesDeleted,
          status,
          error: errors.length ? errors.join("\n").slice(0, 4000) : null,
        })
        .eq("id", runId);
    }
    return { source_id: src.id, podcasts_seen: podcastsSeen, episodes_new: episodesNew, episodes_updated: episodesUpdated, episodes_deleted: episodesDeleted, errors, status };
  } catch (e) {
    const msg = (e as Error).message;
    if (runId) {
      await supabaseAdmin
        .from("podcast_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          podcasts_seen: podcastsSeen,
          episodes_new: episodesNew,
          episodes_updated: episodesUpdated,
          episodes_deleted: episodesDeleted,
          status: "error",
          error: msg.slice(0, 4000),
        })
        .eq("id", runId);
    }
    return { source_id: src.id, podcasts_seen: podcastsSeen, episodes_new: episodesNew, episodes_updated: episodesUpdated, episodes_deleted: episodesDeleted, errors: [msg], status: "error" };
  }
}

export async function syncAllActiveSources(): Promise<SyncSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("podcast_sources")
    .select("id")
    .eq("is_active", true);
  if (error) throw error;
  const results: SyncSummary[] = [];
  for (const row of (data ?? []) as Array<{ id: string }>) {
    results.push(await syncSource(row.id));
  }
  return results;
}

export async function refreshPodcast(podcastId: string): Promise<SyncSummary> {
  const { data, error } = await supabaseAdmin
    .from("podcasts")
    .select("source_id")
    .eq("id", podcastId)
    .single();
  if (error || !data) throw new Error(error?.message || "Podcast not found");
  return syncSource(data.source_id as string);
}
