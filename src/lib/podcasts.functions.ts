/**
 * Podcast Hub — client-importable server functions.
 *
 * UI calls these from the admin pages; server-only sync logic lives in
 * src/server/podcast-sync.server.ts and is loaded lazily inside handlers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireRole(context: { supabase: any; userId: string | null }, roles: string[]) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const has = (data ?? []).some((r: { role: string }) => roles.includes(r.role));
  if (!has) throw new Response("Forbidden", { status: 403 });
}

// ---------- Sources ----------

const sourceUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  kind: z.enum(["fablesh", "rss"]),
  base_url: z.string().url().max(500),
  auth_secret_name: z.string().max(120).nullable().optional(),
  sync_interval_minutes: z.number().int().min(1).max(1440).optional(),
  is_active: z.boolean().optional(),
});

export const listPodcastSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("podcast_sources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { sources: data ?? [] };
  });

export const upsertPodcastSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => sourceUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["admin"]);
    const payload = {
      name: data.name.trim(),
      kind: data.kind,
      base_url: data.base_url.trim(),
      auth_secret_name: data.auth_secret_name?.trim() || null,
      sync_interval_minutes: data.sync_interval_minutes ?? 15,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("podcast_sources")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return { source: row };
    }
    const { data: row, error } = await context.supabase
      .from("podcast_sources")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return { source: row };
  });

export const deletePodcastSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["admin"]);
    const { error } = await context.supabase.from("podcast_sources").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

// ---------- Podcasts & episodes ----------

export const listPodcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ source_id: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("podcasts")
      .select("*, podcast_sources(name,kind)")
      .order("title", { ascending: true });
    if (data.source_id) q = q.eq("source_id", data.source_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { podcasts: rows ?? [] };
  });

export const listEpisodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ podcast_id: z.string().uuid(), include_deleted: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("podcast_episodes")
      .select("*")
      .eq("podcast_id", data.podcast_id)
      .order("publish_date", { ascending: false, nullsFirst: false });
    if (!data.include_deleted) q = q.is("deleted_at", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { episodes: rows ?? [] };
  });

// ---------- Sync ----------

export const triggerPodcastSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ source_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["admin", "editor"]);
    const { syncSource } = await import("@/server/podcast-sync.server");
    const result = await syncSource(data.source_id);
    return { result };
  });

export const triggerPodcastRefresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ podcast_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["admin", "editor"]);
    const { refreshPodcast } = await import("@/server/podcast-sync.server");
    const result = await refreshPodcast(data.podcast_id);
    return { result };
  });

export const listSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ source_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("podcast_sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(data.limit ?? 25);
    if (data.source_id) q = q.eq("source_id", data.source_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { runs: rows ?? [] };
  });

// ---------- Station subscriptions ----------

const subSchema = z.object({
  id: z.string().uuid().optional(),
  station_id: z.string().uuid(),
  podcast_id: z.string().uuid(),
  priority: z.number().int().min(0).max(100).optional(),
  auto_import: z.boolean().optional(),
  manual_review: z.boolean().optional(),
  max_episodes: z.number().int().min(1).max(10000).nullable().optional(),
  allow_explicit: z.boolean().optional(),
  only_swedish: z.boolean().optional(),
  only_owned: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ station_id: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("station_podcast_subscriptions")
      .select("*, podcasts(title,artwork_url,language), stations(name)")
      .order("priority", { ascending: false });
    if (data.station_id) q = q.eq("station_id", data.station_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { subscriptions: rows ?? [] };
  });

export const upsertSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => subSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["admin", "editor"]);
    const payload = {
      station_id: data.station_id,
      podcast_id: data.podcast_id,
      priority: data.priority ?? 50,
      auto_import: data.auto_import ?? true,
      manual_review: data.manual_review ?? false,
      max_episodes: data.max_episodes ?? null,
      allow_explicit: data.allow_explicit ?? true,
      only_swedish: data.only_swedish ?? false,
      only_owned: data.only_owned ?? false,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("station_podcast_subscriptions")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw error;
      return { subscription: row };
    }
    const { data: row, error } = await context.supabase
      .from("station_podcast_subscriptions")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return { subscription: row };
  });

export const deleteSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["admin", "editor"]);
    const { error } = await context.supabase
      .from("station_podcast_subscriptions")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

// ---------- Stats ----------

export const podcastStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ station_id: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const [{ count: podcastCount }, { count: episodeCount }, plays, runs] = await Promise.all([
      context.supabase.from("podcasts").select("*", { count: "exact", head: true }),
      context.supabase.from("podcast_episodes").select("*", { count: "exact", head: true }).is("deleted_at", null),
      data.station_id
        ? context.supabase
            .from("podcast_play_log")
            .select("id, played_at, episode_id", { count: "exact" })
            .eq("station_id", data.station_id)
            .order("played_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], count: 0, error: null }),
      context.supabase
        .from("podcast_sync_runs")
        .select("id, status, started_at, source_id")
        .order("started_at", { ascending: false })
        .limit(10),
    ]);
    return {
      podcasts: podcastCount ?? 0,
      episodes: episodeCount ?? 0,
      recent_plays: plays.data ?? [],
      play_count: plays.count ?? 0,
      recent_runs: runs.data ?? [],
    };
  });
