# src/lib — Backend Server Functions and Frontend Utilities

This directory contains two kinds of files that must be kept clearly separated:

## 1. Server functions (`*.functions.ts`)

Files ending in `.functions.ts` contain `createServerFn` handlers. These run
**server-side only** but are importable by client code via the TanStack Start
`useServerFn` mechanism. They compile to `/_server/*` HTTP endpoints at build time.

**Rules for server function files:**
- May import `requireSupabaseAuth` middleware (JWT validation)
- May import from `src/server/` (server-only modules with secrets)
- Must NOT import `supabaseAdmin` directly — use server modules in `src/server/`
- Must NOT import browser-only APIs or React hooks

| File | Responsibility |
|------|----------------|
| `agents.functions.ts` | Agent instance CRUD, token pairing, ping |
| `backup.functions.ts` | Backup creation and restore triggers |
| `news.functions.ts` | News Hub CRUD and broadcast state |
| `podcasts.functions.ts` | Podcast source sync, episode management |
| `public-station.functions.ts` | Public-facing station data (no auth required) |
| `r2-storage.functions.ts` | R2 object listing, presigned URLs, deletion |
| `runtime-targets.functions.ts` | Runtime target CRUD and health checks |
| `storage-targets.functions.ts` | Storage adapter target CRUD |
| `streaming-outputs.functions.ts` | Streaming output CRUD |
| `streaming.functions.ts` | Station config generation (Icecast XML, Liquidsoap .liq, M3U) |
| `sync.functions.ts` | Sync job management |
| `system-events.functions.ts` | System event log writes |

### Legacy server functions

- `azuracast-runtime.functions.ts` — **LEGACY** Direct AzuraCast API calls (skip,
  queue, restart). Hidden from UI. Do not extend. Will be removed after
  `azuracast_connections` is retired.
  See: `docs/architecture/radio-core-v2.md` §3 (AzuraCast phase-out plan)

## 2. Frontend utilities (`*.ts`, `*.tsx` without `.functions.`)

Pure client-side code: React contexts, hooks, and utility functions.

| File | Responsibility |
|------|----------------|
| `auth.tsx` | `AuthProvider` and `useAuth` hook (Supabase session + roles) |
| `station-context.tsx` | `StationProvider` — active station selection and scoping |
| `player-context.tsx` | `PlayerProvider` — mini-player state |
| `theme.tsx` | Theme provider (dark/light mode) |
| `media-kind.ts` | `MEDIA_KINDS` constant and type definitions |
| `use-public-station.ts` | Hook for public (unauthenticated) station data |
| `utils.ts` | `cn()` and other shared utilities |
| `validation.ts` | Zod schemas shared between client and server |
| `audit.ts` | Audit log helper functions |
| `audio-processor.ts` | Client-side audio utilities |

## Architecture boundary

```
src/routes/*.tsx         (Frontend)
  ↓  useServerFn()
src/lib/*.functions.ts   (Backend: createServerFn handlers)
  ↓  import
src/server/*.server.ts   (Backend: server-only modules with secrets)
  ↓  import
supabaseAdmin / R2 / external APIs
```

Never import `src/server/*.server.ts` directly from route files or React components.
