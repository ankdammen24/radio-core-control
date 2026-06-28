/**
 * Internal server functions for the News module (admin UI).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";

const NEWS_STATUSES = ["draft", "processing", "ready_for_radio", "broadcasted", "archived", "expired"] as const;
const NEWS_PRIORITIES = ["low", "normal", "high", "breaking"] as const;

const NewsInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(500),
  short_title: z.string().max(200).optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  full_article: z.string().max(50000).optional().nullable(),
  radio_script: z.string().max(20000).optional().nullable(),
  region: z.string().max(100).optional().nullable(),
  municipality: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  priority: z.enum(NEWS_PRIORITIES).default("normal"),
  language: z.string().min(2).max(10).default("sv"),
  source: z.string().max(200).optional().nullable(),
  tags: z.array(z.string().max(50)).max(50).default([]),
  estimated_duration_seconds: z.number().int().min(0).max(7200).optional().nullable(),
  audio_url: z.string().url().max(2000).optional().nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
  status: z.enum(NEWS_STATUSES).default("draft"),
  external_id: z.string().max(200).optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
});

export const listNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("news_items").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.status) q = q.eq("status", data.status as typeof NEWS_STATUSES[number]);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getNewsItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("news_items").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertNewsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => NewsInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { data: row, error } = await context.supabase
        .from("news_items").update(rest).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("news_items").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setNewsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(NEWS_STATUSES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("news_items").update({ status: data.status }).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteNewsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("news_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getNewsBroadcastHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { newsItemId: string }) =>
    z.object({ newsItemId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("news_broadcast_history")
      .select("id, broadcast_time, program_name, station_id, stations(name,slug)")
      .eq("news_item_id", data.newsItemId)
      .order("broadcast_time", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Generate (or rotate) a station API key. Returns the plaintext key ONCE.
 * Only the SHA-256 hash is stored in stations.api_key_hash.
 */
export const generateStationApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ stationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Ensure caller is admin
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");

    const plaintext = `rck_${randomBytes(24).toString("base64url")}`;
    const hash = createHash("sha256").update(plaintext, "utf8").digest("hex");
    const { error } = await context.supabase
      .from("stations").update({ api_key_hash: hash }).eq("id", data.stationId);
    if (error) throw new Error(error.message);
    return { plaintext };
  });
