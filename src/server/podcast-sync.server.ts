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
    external_id: p.id,
    title: p.title,
    description: p.long_description ?? p.short_description ?? null,
    language: p.language ?? null,
    categories: [p.primary_category, p.primary_subcategory].filter(Boolean) as string[],
    artwork_url: p.artwork_url ?? null,
    owner: p.author ?? null,
    last_updated_at: p.feed_last_build_at ?? null,
    checksum: null as string | null,
  };
}

function mapEpisode(podcast_id: string, e: FableshEpisode) {
  return {
    podcast_id,
    guid: e.id,
    title: e.title,
    description: e.description ?? null,
    publish_date: e.published_at ?? null,
    duration_seconds: e.duration_seconds ?? null,
    explicit: !!e.explicit,
    season: e.season ?? null,
    episode_number: e.episode_number ?? null,
    audio_url: e.audio_url,
    audio_format: e.audio_mime ?? null,
    artwork_url: e.artwork_url ?? null,
    transcript_url: e.transcript_url ?? null,
    checksum: null as string | null,
    version: 1,
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
        const existing = localIdx.get(rp.id);

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
          rp.id,
        );
        const remoteGuids = new Set(remoteEps.map((e) => e.id));


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
          const existingEp = localEpIdx.get(re.id);
          if (!existingEp) {
            const { error } = await supabaseAdmin.from("podcast_episodes").insert(mappedEp);
            if (error) throw error;
            episodesNew++;
          } else {
            // Fablesh has no per-episode checksum/version; always upsert
            // to keep metadata fresh. Volumes are small.
            const { error } = await supabaseAdmin
              .from("podcast_episodes")
              .update(mappedEp)
              .eq("id", existingEp.id);
            if (error) throw error;
            episodesUpdated++;

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
        errors.push(`podcast ${rp.id}: ${(e as Error).message}`);
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
