
# Radio Core — Broadcast Operations Console: gap-fill plan

Scope confirmed: fill gaps only. Reuse `stack_tokens` for agent auth. Replace `/index` (home) with the aggregated Health Dashboard. Existing tables, pages, RLS, and adapters are preserved.

---

## 1. Database migration (single migration)

New tables (all RLS-enabled, admin/editor write, authenticated read where appropriate, audit triggers on mutating tables):

- **`agent_instances`**
  - `id uuid pk`, `station_id uuid` (nullable for account-wide agents), `name text`, `hostname text`, `version text`, `status` enum (`unknown|online|degraded|offline`) default `unknown`, `capabilities jsonb default '{}'`, `metadata jsonb default '{}'`, `stack_token_id uuid` (FK → `stack_tokens.id`, nullable; pointer only — token hash stays in `stack_tokens`), `last_seen_at timestamptz`, `last_error text`, `created_at`, `updated_at`.
  - Policies: SELECT admin/editor, INSERT/UPDATE/DELETE admin only.

- **`system_events`**
  - `id uuid pk`, `station_id uuid null`, `source text` (e.g. `agent|runtime|storage|sync_worker|web`), `level` enum (`info|warning|error|critical`) default `info`, `event_type text`, `message text`, `details jsonb default '{}'`, `actor_user_id uuid null`, `created_at timestamptz default now()`.
  - Index on `(station_id, created_at desc)`, `(level, created_at desc)`.
  - Policies: SELECT authenticated; INSERT admin/editor (system writes via service role); no UPDATE/DELETE.

- **`sync_jobs` extension** (only if columns are missing — additive ALTERs, never destructive): ensure the `type` text column accepts the new job types `agent_heartbeat`, `loudness_normalize`, `media_import`, `r2_sync`, `storage_check`, `runtime_check`, `azuracast_sync`, `stream_health_check` (text column, no enum lock-in).

- **`stack_tokens` extension**: add nullable `purpose text` (`'api'|'agent'`) default `'api'` so agent tokens are distinguishable. Backfill existing rows to `'api'`.

No changes to existing `runtime_targets`, `storage_targets`, `runtime_health_checks`, `storage_health_checks`, `service_health` — they already cover the spec.

---

## 2. Adapter & client stubs (server-only, mockable)

New files under `src/server/`:

- `runtime-adapters/icecast.ts` — implements `RuntimeAdapter` from existing `types.ts`. Stub `testConnection()` does an HTTP GET on `${base_url}/status-json.xsl`, parses listeners if reachable, otherwise returns `{ status: "unknown", reachable: false }`. `fetchNowPlaying()` returns a normalized object from the same JSON when available.
- `runtime-adapters/liquidsoap.ts` — stub adapter. `testConnection()` attempts a telnet-style HTTP probe if `metadata.telnet_url` is set; otherwise returns mock `ok` with `message: "Liquidsoap adapter stub"`.
- `runtime-adapters/stereo-tool.ts` — stub adapter. Returns mock `ok` with `serverInfo: { mode: "stub" }` until a real probe is wired.
- `runtime-adapters/index.ts` — extend `buildAdapter()` switch to route the three new types alongside `azuracast` (existing `custom` falls back to a generic HTTP-ping stub).
- `agent-client.server.ts` — typed client for the future Node.js agent: `pingAgent(agent)`, `dispatchJob(agent, job)`, `revokeAgent(agent)`. All methods are stubs that record a `system_events` row and return `{ ok: true, mocked: true }` so the UI works end-to-end before a real agent exists.
- `storage-adapters/` — already has `r2.ts`; add `local.ts` and `external-url.ts` stub adapters implementing the existing `StorageAdapter` interface (return `ok` for `local`; `external-url` only validates URL reachability).

Secrets policy preserved: adapters read `*_secret_name` references and resolve via existing `resolveSecret()`. No raw secrets enter any table.

---

## 3. Server functions

New `src/lib/agents.functions.ts`:
- `listAgents({ station_id? })` — admin/editor read.
- `upsertAgent(input)` — admin only; validates with Zod; never writes a token, only `stack_token_id`.
- `deleteAgent({ id })` — admin only.
- `pingAgentNow({ id })` — admin only; calls `agent-client.server.pingAgent`, updates `last_seen_at` + `status`, writes a `system_events` row.

New `src/lib/system-events.functions.ts`:
- `listSystemEvents({ station_id?, limit?, level? })` — authenticated.
- `recordSystemEvent(input)` — admin/editor only (server-internal helper also exported for other server fns).

New `src/lib/dashboard.functions.ts`:
- `getOperationsOverview({ station_id? })` — single aggregated read returning `{ stations, runtimeTargets, storageTargets, agents, recentSyncJobs, recentEvents, latestHealth }` for the dashboard. Authenticated.

---

## 4. UI: replace `/index` with Operations Dashboard

`src/routes/index.tsx`:
- Header: "Radio Core" + tagline "Broadcast Operations Console".
- Top status row: 4 cards — Stations, Runtime Targets, Storage Targets, Agents — each showing healthy/degraded/down counts (from existing health tables + new `agent_instances.status`).
- "Now Playing" placeholder card (uses existing `now_playing` table when present, else "No active stream").
- Two-column grid:
  - Recent Sync Jobs (last 10, with status pill + duration).
  - System Events feed (last 15, level-coloured).
- Latest health checks summary: links into existing `/runtime-targets`, `/storage-targets`, `/health` pages.
- All cards use existing `resource-page-shell`, `status-badge`, and design tokens — no new colors. Loading + empty states via `data-states`.

New `/agents` route (`src/routes/agents.tsx`):
- List `agent_instances` for the active station (or all stations for admin).
- Create/Edit dialog: name, station, capabilities, paired `stack_tokens` row (admin picks/creates a token via the existing tokens flow — no plaintext shown after creation).
- Per-row actions: Ping (mocked), Revoke (deactivates the linked stack_token), Delete.
- Uses existing sidebar — add a sidebar entry "Agents" under the operations group.

No other existing route is touched.

---

## 5. GitHub-readiness

- **`README.md`** rewrite (kept concise): product summary, architecture diagram (ASCII), tech stack, env-var matrix (web vs agent), quickstart (Lovable Cloud + local dev), folder map, deployment notes, link to `ARCHITECTURE.md` and `STORAGE-DESIGN.md` (already exist).
- **`docs/`** additions:
  - `docs/agents.md` — agent contract: auth via `stack_tokens` (purpose=`agent`), expected heartbeat payload, job dispatch shape.
  - `docs/adapters.md` — how to add a new runtime/storage adapter (interface + registration).
  - `docs/architecture.md` — short pointer file linking to the existing architecture docs.
- No CI files added in this round (out of scope until repo is connected to GitHub); README documents the recommended workflow.

---

## 6. Out of scope (called out so we can plan a follow-up)

- Real Node.js agent implementation (only the contract + client stub here).
- Stereo Tool / Liquidsoap real probes (stubs only).
- Permissions UI for non-admin agent management.
- Migrating any existing Supabase Edge Functions to TanStack server fns.

---

## Technical details

- Migration is single-file, additive only, all new tables get `set_updated_at` triggers and `audit_trigger` where appropriate.
- All server fns use `requireSupabaseAuth` + an inline `requireRole(['admin'])` or `['admin','editor']` check (matching existing pattern in `runtime-targets.functions.ts`).
- `recordSystemEvent` is the canonical write path — adapters and the agent client always log via it so the dashboard event feed is the single source of operational truth.
- No secrets in tables; agent tokens live only in `stack_tokens` (hashed), referenced by `agent_instances.stack_token_id`.
- No changes to `src/integrations/supabase/*` generated files.
- Dashboard reads are batched via `getOperationsOverview` to keep `/` fast (one round-trip for the top-level overview).

After approval I'll run the migration first, then ship the code in one pass (adapters → server fns → routes → README/docs).
