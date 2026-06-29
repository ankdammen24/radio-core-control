/**
 * Shared helpers för att autentisera distribution-API-anrop från radiostationer.
 *
 * En station presenterar `Authorization: Bearer <key>`; vi jämför mot den
 * SHA-256-hash som är lagrad i `stations.api_key_hash` med timing-safe compare.
 *
 * Migrerad från Supabase till Drizzle ORM.
 */
import { createHash, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { stations } from "@/server/db/schema";

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
  const x = request.headers.get("x-api-key");
  return x ? x.trim() || null : null;
}

/**
 * Validerar bearer-nyckeln mot en specifik stations lagrade hash.
 */
export async function authenticateStationRequest(
  request: Request,
  stationId: string,
): Promise<StationAuthResult> {
  const presented = readBearer(request);
  if (!presented) return { ok: false, status: 401, message: "Missing API key" };

  const rows = await db
    .select({ id: stations.id, name: stations.name, slug: stations.slug, apiKeyHash: stations.apiKeyHash, isActive: stations.isActive })
    .from(stations)
    .where(eq(stations.id, stationId))
    .limit(1);

  const data = rows[0] ?? null;
  if (!data) return { ok: false, status: 404, message: "Station not found" };
  if (!data.isActive) return { ok: false, status: 403, message: "Station inactive" };
  if (!data.apiKeyHash) return { ok: false, status: 403, message: "Station has no API key configured" };

  const presentedHash = Buffer.from(hashStationKey(presented), "hex");
  const expectedHash = Buffer.from(data.apiKeyHash, "hex");
  if (
    presentedHash.length !== expectedHash.length ||
    !timingSafeEqual(presentedHash, expectedHash)
  ) {
    return { ok: false, status: 401, message: "Invalid API key" };
  }
  return { ok: true, station: { id: data.id, name: data.name, slug: data.slug } };
}

/**
 * Löser upp vilken station en given bearer-nyckel tillhör.
 * Används när URL:en inte är stationsscoped (t.ex. /api/radio/news).
 */
export async function authenticateStationByKey(request: Request): Promise<StationAuthResult> {
  const presented = readBearer(request);
  if (!presented) return { ok: false, status: 401, message: "Missing API key" };
  const hash = hashStationKey(presented);

  const rows = await db
    .select({ id: stations.id, name: stations.name, slug: stations.slug, isActive: stations.isActive })
    .from(stations)
    .where(eq(stations.apiKeyHash, hash))
    .limit(1);

  const data = rows[0] ?? null;
  if (!data) return { ok: false, status: 401, message: "Invalid API key" };
  if (!data.isActive) return { ok: false, status: 403, message: "Station inactive" };
  return { ok: true, station: { id: data.id, name: data.name, slug: data.slug } };
}
