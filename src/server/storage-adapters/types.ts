/**
 * Storage adapter contract for Radio Core.
 *
 * Adapters wrap a single storage provider (Cloudflare R2, generic S3,
 * local mounted storage, Azure Blob, external CDN URL, …).
 */

export type StorageProvider = "r2" | "s3" | "local" | "azure_blob" | "external_url";
export type StoragePurpose = "media" | "artwork" | "cdn" | "backup" | "exports";
export type StorageStatus = "unknown" | "online" | "warning" | "offline";

export interface StorageTargetConfig {
  id: string;
  station_id: string;
  name: string;
  provider: StorageProvider;
  purpose: StoragePurpose;
  bucket: string | null;
  endpoint_url: string | null;
  region: string | null;
  public_base_url: string | null;
  access_key_ref: string | null;
  secret_key_ref: string | null;
  metadata?: Record<string, unknown>;
}

export interface StorageObjectSummary {
  key: string;
  size?: number;
  last_modified?: string | null;
}

export interface StorageInfo {
  bucket: string | null;
  region: string | null;
  endpoint: string | null;
  public_base_url: string | null;
  object_count?: number | null;
  total_bytes?: number | null;
}

export interface TestResult {
  status: StorageStatus;
  message: string;
  duration_ms: number;
  details?: Record<string, unknown>;
}

export interface StorageAdapter {
  testConnection(): Promise<TestResult>;
  listObjects(prefix?: string, maxKeys?: number): Promise<StorageObjectSummary[]>;
  getStorageInfo(): Promise<StorageInfo>;
  validateBucket(): Promise<{ ok: boolean; message: string }>;
  normalizeStatus(input: string | null | undefined): StorageStatus;
}

export function normalizeStatus(input: string | null | undefined): StorageStatus {
  const v = (input ?? "").toLowerCase();
  if (["ok", "online", "healthy"].includes(v)) return "online";
  if (["warning", "degraded"].includes(v)) return "warning";
  if (["offline", "down", "error", "failed"].includes(v)) return "offline";
  return "unknown";
}
