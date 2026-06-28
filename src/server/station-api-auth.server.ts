/**
 * Shared helpers for authenticating distribution-API calls from radio stations.
 *
 * A station presents `Authorization: Bearer <key>`; we compare against the
 * SHA-256 hash stored on `stations.api_key_hash` using timing-safe compare.
 */
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function hashStationKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export type Station = { id: string; name: string; slug: string };

export type StationAuthResult =
  | { ok: true; station: Station }
  | { ok: false; status: number; message: string };

function readBearer(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim() || null;
  // Allow X-API-Key as alternative for compatibility
  const x = request.headers.get("x-api-key");
  return x ? x.trim() || null : null;
}

/**
 * Validate the bearer key against a specific station's stored hash.
 */
export async function authenticateStationRequest(
  request: Request,
  stationId: string,
): Promise<StationAuthResult> {
  const presented = readBearer(request);
  if (!presented) return { ok: false, status: 401, message: "Missing API key" };

  const { data, error } = await supabaseAdmin
    .from("stations")
    .select("id, name, slug, api_key_hash, is_active")
    .eq("id", stationId)
    .single();
  if (error || !data) return { ok: false, status: 404, message: "Station not found" };
  if (!data.is_active) return { ok: false, status: 403, message: "Station inactive" };
  if (!data.api_key_hash) return { ok: false, status: 403, message: "Station has no API key configured" };

  const presentedHash = Buffer.from(hashStationKey(presented), "hex");
  const expectedHash = Buffer.from(data.api_key_hash, "hex");
  if (
    presentedHash.length !== expectedHash.length ||
    !timingSafeEqual(presentedHash, expectedHash)
  ) {
    return { ok: false, status: 401, message: "Invalid API key" };
  }
  return { ok: true, station: { id: data.id, name: data.name, slug: data.slug } };
}

/**
 * Resolve which station the presented bearer key belongs to.
 * Used when the URL is not station-scoped (e.g. /api/radio/news).
 */
export async function authenticateStationByKey(request: Request): Promise<StationAuthResult> {
  const presented = readBearer(request);
  if (!presented) return { ok: false, status: 401, message: "Missing API key" };
  const hash = hashStationKey(presented);
  const { data, error } = await supabaseAdmin
    .from("stations")
    .select("id, name, slug, is_active, api_key_hash")
    .eq("api_key_hash", hash)
    .maybeSingle();
  if (error) return { ok: false, status: 500, message: error.message };
  if (!data) return { ok: false, status: 401, message: "Invalid API key" };
  if (!data.is_active) return { ok: false, status: 403, message: "Station inactive" };
  return { ok: true, station: { id: data.id, name: data.name, slug: data.slug } };
}
