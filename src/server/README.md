# src/server — Server-Only Backend Modules

All files in this directory are **server-only**. They may access secrets, use
the `supabaseAdmin` service role client, and call external APIs with credentials.
They must never be imported by client-side code.

Enforce this: files are suffixed `.server.ts` so bundler tree-shaking and lint
rules can detect accidental client imports.

## Architecture layer

`src/server` is the **privileged backend** layer of Radio Core. It is always
called indirectly:

```
Browser → createServerFn (src/lib/*.functions.ts) → src/server/*.server.ts
Browser → HTTP route (src/routes/api.public.*.ts) → src/server/*.server.ts
```

## Module inventory

### Core server modules

| File | Responsibility |
|------|----------------|
| `env.server.ts` | Safe environment variable access with validation |
| `station-api-auth.server.ts` | Stack token verification for public API endpoints |
| `streaming.server.ts` | Liquidsoap `.liq` and Icecast XML config rendering |
| `streaming-adapters.server.ts` | Streaming output format adapters |
| `runtime-targets.server.ts` | Runtime target loading and health check orchestration |
| `r2-storage.server.ts` | R2/S3 operations (list, presign, delete) |
| `fablesh-client.server.ts` | Fablesh API client for media import |
| `news-mapper.server.ts` | News Hub data transformation |
| `podcast-sync.server.ts` | Podcast RSS fetch and episode sync |
| `sync-worker.server.ts` | Background sync job processing |
| `agent-client.server.ts` | Agent communication (ping, status) |

### Runtime adapters (`runtime-adapters/`)

Pluggable adapters for different broadcast runtime types.

| File | Adapter |
|------|---------|
| `runtime-adapters/types.ts` | `RuntimeAdapter` interface and shared types |
| `runtime-adapters/index.ts` | `buildAdapter()` factory — selects adapter by target type |
| `runtime-adapters/icecast.ts` | Icecast adapter (health check, config) |
| `runtime-adapters/liquidsoap.ts` | Liquidsoap adapter (telnet, health check) |
| `runtime-adapters/stereo-tool.ts` | Stereo Tool adapter |

#### Legacy runtime adapters

- `runtime-adapters/azuracast.ts` — **LEGACY** AzuraCast runtime adapter.
  Still referenced by `buildAdapter()` for `type: 'azuracast'` targets.
  Will be removed when AzuraCast targets are retired from the DB.
  See: `docs/architecture/radio-core-v2.md` §3 (AzuraCast phase-out plan)

### Storage adapters (`storage-adapters/`)

| File | Adapter |
|------|---------|
| `storage-adapters/types.ts` | `StorageAdapter` interface |
| `storage-adapters/index.ts` | Adapter factory |
| `storage-adapters/r2.ts` | Cloudflare R2 via S3-compatible API |

### Legacy server modules

- `azuracast-client.server.ts` — **LEGACY** Typed AzuraCast REST API client.
  Used only by `azuracast-runtime.functions.ts` and the AzuraCast adapter.
  Will be removed with those consumers.
  See: `docs/architecture/radio-core-v2.md` §3 (AzuraCast phase-out plan)

## Rules

- All files must end in `.server.ts` (enforced by convention, add ESLint rule later)
- Never `import.meta.env.VITE_*` here — those are client-only variables
- Use `readEnv()` from `env.server.ts` for all environment variable access
- Never return raw credentials to the client — only strip results before serialising
