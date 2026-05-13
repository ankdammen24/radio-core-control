/**
 * Storage adapter registry. R2 is the first implemented adapter; other
 * providers fall back to a stub that surfaces a clear "not implemented" error
 * so the data model and UI can already represent them.
 */
import type { StorageAdapter, StorageTargetConfig, TestResult } from "./types";
import { normalizeStatus } from "./types";
import { R2Adapter } from "./r2";

class StubAdapter implements StorageAdapter {
  constructor(private cfg: StorageTargetConfig, private label: string) {}
  normalizeStatus = normalizeStatus;
  async testConnection(): Promise<TestResult> {
    return {
      status: "unknown",
      message: `${this.label} adapter not implemented yet — registration is stored, but live checks are unavailable.`,
      duration_ms: 0,
    };
  }
  async listObjects() { return []; }
  async getStorageInfo() {
    return {
      bucket: this.cfg.bucket,
      region: this.cfg.region,
      endpoint: this.cfg.endpoint_url,
      public_base_url: this.cfg.public_base_url,
    };
  }
  async validateBucket() {
    return { ok: false, message: `${this.label} adapter not implemented` };
  }
}

class ExternalUrlAdapter implements StorageAdapter {
  constructor(private cfg: StorageTargetConfig) {}
  normalizeStatus = normalizeStatus;
  async testConnection(): Promise<TestResult> {
    const start = Date.now();
    const url = this.cfg.public_base_url ?? this.cfg.endpoint_url;
    if (!url) return { status: "offline", message: "No public URL configured", duration_ms: 0 };
    try {
      const res = await fetch(url, { method: "HEAD" });
      const duration_ms = Date.now() - start;
      if (res.ok || res.status === 403 || res.status === 404) {
        return { status: "online", message: `Reachable (HTTP ${res.status})`, duration_ms };
      }
      return { status: "warning", message: `HTTP ${res.status}`, duration_ms };
    } catch (e) {
      return { status: "offline", message: (e as Error).message, duration_ms: Date.now() - start };
    }
  }
  async listObjects() { return []; }
  async getStorageInfo() {
    return {
      bucket: this.cfg.bucket,
      region: this.cfg.region,
      endpoint: this.cfg.endpoint_url,
      public_base_url: this.cfg.public_base_url,
    };
  }
  async validateBucket() { return { ok: true, message: "External URL — bucket validation not applicable" }; }
}

export function buildStorageAdapter(cfg: StorageTargetConfig): StorageAdapter {
  switch (cfg.provider) {
    case "r2":
    case "s3":
      return new R2Adapter(cfg);
    case "external_url":
      return new ExternalUrlAdapter(cfg);
    case "azure_blob":
      return new StubAdapter(cfg, "Azure Blob");
    case "local":
      return new StubAdapter(cfg, "Local mount");
    default:
      return new StubAdapter(cfg, cfg.provider);
  }
}

export type { StorageAdapter, StorageTargetConfig, TestResult } from "./types";
