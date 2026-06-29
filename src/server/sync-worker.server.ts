// Sync worker: dispatches sync_jobs to typed handlers.
// Server-only. Imported by the cron-triggered server route.

import { adminDatabase } from "@/services/database/server";
import { AzuracastError, buildAzuracastClient, type AzuracastConnectionRow } from "./azuracast-client.server";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readEnv } from "@/server/env.server";
import { parseMediaKind, type MediaKind } from "@/lib/media-kind";

interface SyncJob {
  id: string;
  job_type: string;
  station_id: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
}

type HandlerResult = Record<string, unknown> | void;
type Handler = (job: SyncJob) => Promise<HandlerResult>;

// Error carrying extra structured context (e.g. current storage target fields).
export class SyncWorkerError extends Error {
  context: Record<string, unknown>;
  cause?: unknown;
  constructor(message: string, context: Record<string, unknown>, cause?: unknown) {
    super(message);
    this.name = "SyncWorkerError";
    this.context = context;
    this.cause = cause;
  }
}

export function firstAppStackFrame(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const lines = stack.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("at "));
  // Prefer frames pointing at our own source; fall back to the topmost frame.
  return lines.find((l) => l.includes("/src/server/") || l.includes("sync-worker")) ?? lines[0];
}

export function requireTargetForSeparatedBuckets(targetId: unknown, mediaKind: MediaKind) {
  if (mediaKind !== "music" && typeof targetId !== "string") {
    throw new Error(`target_id is required when media_kind is "${mediaKind}"`);
  }
}

// Pure helper: given a storage_targets row and an env reader, resolve the
// effective S3 credentials + structured context. Throws SyncWorkerError when
// any required credential field is missing. Extracted so it can be unit-tested
// without a live Supabase/S3 connection.
export interface StorageTargetRow {
  id: string;
  bucket: string;
  endpoint_url: string | null;
  region: string | null;
  access_key_ref: string | null;
  secret_key_ref: string | null;
}

export interface ResolvedStorageCredentials {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  context: Record<string, unknown>;
}

export function resolveStorageTargetCredentials(
  target: StorageTargetRow,
  mediaKind: MediaKind,
  envReader: (name: string, fallback?: string) => string | undefined,
): ResolvedStorageCredentials {
  const endpoint = target.endpoint_url ?? envReader("S3_ENDPOINT");
  const region = target.region ?? envReader("S3_REGION", "auto") ?? "auto";
  const accessKeyId =
    (target.access_key_ref ? envReader(target.access_key_ref) : undefined) ??
    envReader("S3_ACCESS_KEY_ID");
  const secretAccessKey =
    (target.secret_key_ref ? envReader(target.secret_key_ref) : undefined) ??
    envReader("S3_SECRET_ACCESS_KEY");
  const context = {
    target_id: target.id,
    bucket: target.bucket,
    endpoint,
    region,
    access_key_ref: target.access_key_ref ?? null,
    secret_key_ref: target.secret_key_ref ?? null,
    has_access_key: Boolean(accessKeyId),
    has_secret_key: Boolean(secretAccessKey),
    mediaKind,
  };
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new SyncWorkerError("Storage target credentials missing", context);
  }
  return { endpoint, region, accessKeyId, secretAccessKey, context };
}

// ---------- helpers ----------

async function loadConnection(opts: { connection_id?: string; station_id?: string | null }): Promise<AzuracastConnectionRow> {
  let q = adminDatabase.from("azuracast_connections").select("id,station_id,base_url,azuracast_station_id,api_key_secret_name").limit(1);
  if (opts.connection_id) q = q.eq("id", opts.connection_id);
  else if (opts.station_id) q = q.eq("station_id", opts.station_id);
  else throw new Error("connection_id or station_id required");
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Azuracast connection not found");
  return data as AzuracastConnectionRow;
}

function payloadConnId(job: SyncJob): { connection_id?: string; station_id?: string | null } {
  const p = (job.payload ?? {}) as Record<string, unknown>;
  return {
    connection_id: typeof p.connection_id === "string" ? p.connection_id : undefined,
    station_id: typeof p.station_id === "string" ? p.station_id : job.station_id,
  };
}

// ---------- handlers ----------

const handlers: Record<string, Handler> = {
  // ---- pull: now playing ----
  "azuracast.pull.now_playing": async (job) => {
    const conn = await loadConnection(payloadConnId(job));
    const client = buildAzuracastClient(conn);
    const np = (await client.nowPlaying()) as {
      now_playing?: { song?: { title?: string; artist?: string; album?: string }; duration?: number; played_at?: number };
      listeners?: { current?: number };
    } | null;
    if (!np?.now_playing?.song || !conn.station_id) return { ok: true, no_data: true };
    const song = np.now_playing.song;
    await adminDatabase.from("now_playing").delete().eq("station_id", conn.station_id);
    await adminDatabase.from("now_playing").insert({
      station_id: conn.station_id,
      title: song.title ?? null,
      artist: song.artist ?? null,
      album: song.album ?? null,
      duration_seconds: np.now_playing.duration ?? null,
      listeners: np.listeners?.current ?? 0,
      started_at: new Date((np.now_playing.played_at ?? Date.now() / 1000) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { ok: true, title: song.title };
  },

  // ---- pull: listener stats ----
  "azuracast.pull.listeners": async (job) => {
    const conn = await loadConnection(payloadConnId(job));
    const client = buildAzuracastClient(conn);
    const np = (await client.nowPlaying()) as { listeners?: { current?: number; unique?: number; total?: number } } | null;
    if (!conn.station_id) return { ok: true, skipped: "no station" };
    await adminDatabase.from("listener_stats").insert({
      station_id: conn.station_id,
      listeners: np?.listeners?.current ?? 0,
      peak_listeners: np?.listeners?.total ?? np?.listeners?.unique ?? 0,
    });
    return { ok: true, listeners: np?.listeners?.current ?? 0 };
  },

  // ---- pull: history (recent plays) ----
  "azuracast.pull.history": async (job) => {
    const conn = await loadConnection(payloadConnId(job));
    const client = buildAzuracastClient(conn);
    const history = (await client.getHistory()) as Array<{
      song?: { title?: string; artist?: string; album?: string };
      duration?: number;
      played_at?: number;
      listeners_start?: number;
    }>;
    if (!conn.station_id) return { ok: true, skipped: "no station" };
    const rows = (history ?? []).slice(0, 50).map((h) => ({
      station_id: conn.station_id,
      title: h.song?.title ?? null,
      artist: h.song?.artist ?? null,
      album: h.song?.album ?? null,
      duration_seconds: h.duration ?? null,
      listeners: h.listeners_start ?? null,
      played_at: new Date((h.played_at ?? Date.now() / 1000) * 1000).toISOString(),
    }));
    if (rows.length) await adminDatabase.from("play_history").insert(rows as Array<typeof rows[number] & { station_id: string }>);
    return { ok: true, inserted: rows.length };
  },

  // ---- runtime: skip current song ----
  "azuracast.runtime.skip": async (job) => {
    const conn = await loadConnection(payloadConnId(job));
    const client = buildAzuracastClient(conn);
    return { ok: true, result: await client.skipSong() };
  },

  // ---- runtime: restart broadcasting ----
  "azuracast.runtime.restart": async (job) => {
    const conn = await loadConnection(payloadConnId(job));
    const client = buildAzuracastClient(conn);
    return { ok: true, result: await client.restartStation() };
  },

  // ---- runtime: clear queue ----
  "azuracast.runtime.clear_queue": async (job) => {
    const conn = await loadConnection(payloadConnId(job));
    const client = buildAzuracastClient(conn);
    return { ok: true, result: await client.clearQueue() };
  },

  // ---- sync: mirror an AzuraCast playlist into a Storage Target (R2 media bucket) ----
  "azuracast.sync.playlist_to_storage": async (job) => {
    const conn = await loadConnection(payloadConnId(job));
    const client = buildAzuracastClient(conn);
    const p = (job.payload ?? {}) as Record<string, unknown>;
    const playlistName = (typeof p.playlist_name === "string" && p.playlist_name) || "Default";
    const limit = typeof p.limit === "number" ? Math.min(p.limit, 5000) : 1000;
    const dryRun = p.dry_run === true;
    const mediaKind = parseMediaKind(p.media_kind);
    requireTargetForSeparatedBuckets(p.target_id, mediaKind);

    // Resolve target storage bucket: explicit target_id OR the active media target for the station.
    // IMPORTANT: when running separate buckets (music/jingles/fx), provide target_id explicitly per job.
    let targetQuery = adminDatabase
      .from("storage_targets")
      .select("id,bucket,endpoint_url,region,access_key_ref,secret_key_ref")
      .eq("is_active", true)
      .limit(1);
    if (typeof p.target_id === "string") targetQuery = targetQuery.eq("id", p.target_id);
    else targetQuery = targetQuery.eq("station_id", conn.station_id!).eq("purpose", "media");
    const { data: target, error: tErr } = await targetQuery.maybeSingle();
    if (tErr) throw new SyncWorkerError("Failed to load storage target", { target_id: p.target_id ?? null, station_id: conn.station_id, mediaKind }, tErr);
    if (!target?.bucket) throw new SyncWorkerError("No active media storage target found for this station", { target_id: p.target_id ?? null, station_id: conn.station_id, mediaKind });

    const { endpoint, region, accessKeyId, secretAccessKey } = resolveStorageTargetCredentials(
      target as StorageTargetRow,
      mediaKind,
      readEnv,
    );

    const s3 = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });

    // Fetch media filtered by playlist via AzuraCast search syntax
    const listed = await client.listMedia({
      searchPhrase: `playlist:${playlistName}`,
      currentPage: 1,
      rowCount: limit,
    });
    const rows = (Array.isArray(listed) ? listed : (listed as { rows?: unknown[] })?.rows ?? []) as Array<{
      id?: number | string;
      unique_id?: string;
      path?: string;
      title?: string;
      artist?: string;
      album?: string;
      length?: number;
      mtime?: number;
      size?: number;
      mime_type?: string;
    }>;

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ path?: string; message: string; at?: string; target_bucket?: string }> = [];

    for (const row of rows) {
      const path = row.path;
      if (!path) { skipped++; continue; }
      const key = path.replace(/^\/+/, "");
      try {
        // Skip if already in bucket
        try {
          await s3.send(new HeadObjectCommand({ Bucket: target.bucket, Key: key }));
          skipped++;
          continue;
        } catch { /* not present, continue to upload */ }

        if (dryRun) { uploaded++; continue; }

        const { bytes, contentType } = await client.downloadFileByPath(path);
        await s3.send(new PutObjectCommand({
          Bucket: target.bucket,
          Key: key,
          Body: bytes,
          ContentType: row.mime_type ?? contentType,
          Metadata: {
            azuracast_id: String(row.id ?? row.unique_id ?? ""),
            title: (row.title ?? "").slice(0, 200),
            artist: (row.artist ?? "").slice(0, 200),
          },
        }));

        // Upsert media_files row keyed by azuracast_media_id
        if (conn.station_id) {
          const azId = String(row.id ?? row.unique_id ?? "");
          await adminDatabase.from("media_files").upsert({
            station_id: conn.station_id,
            azuracast_media_id: azId,
            file_name: path.split("/").pop() ?? path,
            original_file_name: path.split("/").pop() ?? path,
            file_path: key,
            mime_type: row.mime_type ?? contentType,
            file_size: row.size ?? bytes.byteLength,
            duration_seconds: row.length ?? null,
            media_kind: mediaKind,
            status: "imported",
          }, { onConflict: "azuracast_media_id" });
        }
        uploaded++;
      } catch (e) {
        failed++;
        const err = e as Error;
        errors.push({
          path,
          message: err.message,
          at: firstAppStackFrame(err.stack),
          target_bucket: target.bucket,
        });
      }
    }

    return {
      ok: true,
      playlist: playlistName,
      total_listed: rows.length,
      uploaded,
      skipped,
      failed,
      errors: errors.slice(0, 20),
      target_bucket: target.bucket,
      dry_run: dryRun,
    };
  },
};

// ---------- runner ----------

export interface RunResult {
  picked: number;
  succeeded: number;
  failed: number;
  details: Array<{ id: string; job_type: string; status: "completed" | "failed"; message?: string }>;
}

export async function runSyncWorker(opts: { limit?: number; worker?: string } = {}): Promise<RunResult> {
  const limit = opts.limit ?? 10;
  const worker = opts.worker ?? "cron";

  const { data: jobs, error } = await adminDatabase.rpc("claim_sync_jobs", { _limit: limit, _worker: worker });
  if (error) throw error;
  const claimed = (jobs ?? []) as SyncJob[];

  const result: RunResult = { picked: claimed.length, succeeded: 0, failed: 0, details: [] };

  for (const job of claimed) {
    const handler = handlers[job.job_type];
    if (!handler) {
      await adminDatabase.from("sync_jobs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        message: `Unknown job_type: ${job.job_type}`,
      }).eq("id", job.id);
      result.failed++;
      result.details.push({ id: job.id, job_type: job.job_type, status: "failed", message: "unknown job_type" });
      continue;
    }

    try {
      const out = await handler(job);
      await adminDatabase.from("sync_jobs").update({
        status: "completed",
        finished_at: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result: (out ?? { ok: true }) as any,
        message: null,
      }).eq("id", job.id);
      result.succeeded++;
      result.details.push({ id: job.id, job_type: job.job_type, status: "completed" });
    } catch (e) {
      const err = e as Error & { status?: number; body?: unknown };
      const context = e instanceof SyncWorkerError ? e.context : undefined;
      const at = firstAppStackFrame(err.stack);
      const baseMessage = e instanceof AzuracastError
        ? `${err.message} :: ${typeof err.body === "string" ? err.body : JSON.stringify(err.body)}`
        : err.message ?? String(e);
      const message = [
        baseMessage,
        at ? `at ${at}` : null,
        context ? `context=${JSON.stringify(context)}` : null,
      ].filter(Boolean).join(" | ");
      console.error("[sync-worker] job failed", {
        job_id: job.id,
        job_type: job.job_type,
        station_id: job.station_id,
        attempts: job.attempts,
        message: baseMessage,
        at,
        context,
        stack: err.stack,
      });
      const willRetry = job.attempts < job.max_attempts;
      const backoffSec = Math.min(60 * Math.pow(2, job.attempts), 3600);
      await adminDatabase.from("sync_jobs").update({
        status: willRetry ? "pending" : "failed",
        finished_at: willRetry ? null : new Date().toISOString(),
        scheduled_for: willRetry ? new Date(Date.now() + backoffSec * 1000).toISOString() : undefined,
        message,
        locked_at: null,
        locked_by: null,
      }).eq("id", job.id);
      result.failed++;
      result.details.push({ id: job.id, job_type: job.job_type, status: "failed", message });
    }
  }

  return result;
}
