/**
 * Cloudflare R2 storage adapter (S3-compatible API).
 * Server-only.
 */
import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { readEnv } from "@/server/env.server";
import {
  type StorageAdapter,
  type StorageInfo,
  type StorageObjectSummary,
  type StorageTargetConfig,
  type TestResult,
  normalizeStatus,
} from "./types";

function envOr(name: string | null | undefined, fallback?: string): string | undefined {
  if (!name) return fallback;
  return readEnv(name, fallback);
}

export class R2Adapter implements StorageAdapter {
  constructor(private cfg: StorageTargetConfig) {}

  private buildClient(): S3Client {
    const endpoint = this.cfg.endpoint_url ?? readEnv("S3_ENDPOINT");
    const region = this.cfg.region ?? readEnv("S3_REGION", "auto") ?? "auto";
    const accessKeyId = envOr(this.cfg.access_key_ref, readEnv("S3_ACCESS_KEY_ID"));
    const secretAccessKey = envOr(this.cfg.secret_key_ref, readEnv("S3_SECRET_ACCESS_KEY"));

    if (!endpoint) throw new Error("R2 endpoint URL is missing");
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials are missing (set S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY or configure secret refs)");
    }

    return new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  normalizeStatus = normalizeStatus;

  async validateBucket(): Promise<{ ok: boolean; message: string }> {
    if (!this.cfg.bucket) return { ok: false, message: "No bucket configured" };
    try {
      const client = this.buildClient();
      await client.send(new HeadBucketCommand({ Bucket: this.cfg.bucket }));
      return { ok: true, message: `Bucket "${this.cfg.bucket}" reachable` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async testConnection(): Promise<TestResult> {
    const start = Date.now();
    try {
      const v = await this.validateBucket();
      const duration_ms = Date.now() - start;
      if (!v.ok) {
        return { status: "offline", message: v.message, duration_ms };
      }
      // Probe public URL if configured.
      let publicOk: boolean | null = null;
      if (this.cfg.public_base_url) {
        try {
          const res = await fetch(this.cfg.public_base_url, { method: "HEAD" });
          publicOk = res.ok || res.status === 403 || res.status === 404; // reachable
        } catch {
          publicOk = false;
        }
      }
      const status = publicOk === false ? "warning" : "online";
      return {
        status,
        message: publicOk === false
          ? `Bucket OK; public URL unreachable (${this.cfg.public_base_url})`
          : v.message,
        duration_ms,
        details: { public_url_reachable: publicOk },
      };
    } catch (e) {
      return { status: "offline", message: (e as Error).message, duration_ms: Date.now() - start };
    }
  }

  async listObjects(prefix?: string, maxKeys = 50): Promise<StorageObjectSummary[]> {
    if (!this.cfg.bucket) return [];
    const client = this.buildClient();
    const res = await client.send(new ListObjectsV2Command({
      Bucket: this.cfg.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    }));
    return (res.Contents ?? []).map((o) => ({
      key: o.Key ?? "",
      size: o.Size,
      last_modified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
    }));
  }

  async getStorageInfo(): Promise<StorageInfo> {
    const objs = await this.listObjects(undefined, 1000).catch(() => [] as StorageObjectSummary[]);
    return {
      bucket: this.cfg.bucket,
      region: this.cfg.region,
      endpoint: this.cfg.endpoint_url,
      public_base_url: this.cfg.public_base_url,
      object_count: objs.length,
      total_bytes: objs.reduce((acc, o) => acc + (o.size ?? 0), 0),
    };
  }
}
