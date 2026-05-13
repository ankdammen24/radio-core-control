# Adding a runtime or storage adapter

Radio Core treats every external system (broadcast runtime or object storage) as a pluggable adapter behind a small TypeScript contract. Adding support for a new system means writing one file and registering it.

## Runtime adapters

Contract: [`src/server/runtime-adapters/types.ts`](../src/server/runtime-adapters/types.ts).

```ts
export interface RuntimeAdapter {
  type: RuntimeTargetType;
  testConnection(): Promise<NormalizedStatus>;
  fetchNowPlaying?(): Promise<NormalizedNowPlaying | null>;
}
```

Steps:

1. Create `src/server/runtime-adapters/<name>.ts` exporting a class that implements `RuntimeAdapter`.
2. Register it in `src/server/runtime-adapters/index.ts` inside `buildAdapter()`.
3. Add the new value to the `runtime_target_type` enum (DB) and to the `TYPES` list in `src/routes/runtime-targets.tsx`.

Existing implementations:

- `azuracast.ts` — full (now-playing + status via REST API)
- `icecast.ts` — `status-json.xsl` probe + listener counts
- `liquidsoap.ts` / `stereo-tool.ts` — stubs; pair with a Radio Core Agent for live control

API keys are resolved server-side via `resolveSecret(cfg.api_key_secret_name)` — never store raw secrets in `runtime_targets`.

## Storage adapters

Contract: [`src/server/storage-adapters/types.ts`](../src/server/storage-adapters/types.ts).

```ts
export interface StorageAdapter {
  testConnection(): Promise<TestResult>;
  listObjects(prefix?: string, maxKeys?: number): Promise<StorageObjectSummary[]>;
  getStorageInfo(): Promise<StorageInfo>;
  validateBucket(): Promise<{ ok: boolean; message: string }>;
  normalizeStatus(input: string | null | undefined): StorageStatus;
}
```

Steps:

1. Create `src/server/storage-adapters/<provider>.ts`.
2. Register it in `buildStorageAdapter()` in `src/server/storage-adapters/index.ts`.
3. If it needs new credentials, add them as **secret references** (`access_key_ref`, `secret_key_ref`) — never raw values in the table.

Currently shipped:

- `r2.ts` — Cloudflare R2 (also used for any S3-compatible endpoint)
- `external-url` — public CDN URL probe (inline in `index.ts`)
- `local`, `azure_blob` — registration-only stubs

## Testing

Each adapter is exercised by the **Test connection** action on its respective page (`/runtime-targets`, `/storage-targets`). Results are written to `runtime_health_checks` / `storage_health_checks` and surface on the Operations Dashboard and `/health`.
