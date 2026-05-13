# Architecture

See the top-level [`ARCHITECTURE.md`](../ARCHITECTURE.md) for the platform overview (Radio Core / Listen / Radio Uppsala) and [`STORAGE-DESIGN.md`](../STORAGE-DESIGN.md) for storage layering.

This file documents Radio Core web-app conventions specific to this repo:

- **Server-side logic** lives in `src/lib/*.functions.ts` (`createServerFn`) and `src/routes/api/public/*` (server routes for webhooks, cron, agent endpoints). **Do not** add new Supabase Edge Functions for app logic on this stack.
- **Auth model**: browser uses the publishable Supabase client. Server functions use `requireSupabaseAuth` middleware (acts as the user, RLS applies). Trusted server-only writes use `supabaseAdmin` (service role, bypasses RLS) — never imported in client code.
- **Multi-tenancy**: most operational tables expose authenticated read across stations (intentional for cross-station ops visibility). Writes are admin/editor and station-scoped via `station_id`. Public API tokens (`stack_tokens`) can additionally be pinned to a single station.
- **Secrets**: only references are stored in tables (`*_secret_name`, `*_ref`). Raw values live in Lovable Cloud secrets and are read inside `.handler()` bodies.
- **No raw config files**: all streaming configuration (Icecast XML, Liquidsoap `.liq`, Stereo Tool presets) is generated from DB rows; never instruct users to hand-edit on disk.

For agent ↔ web app contract see [`./agents.md`](./agents.md). For adding new adapters see [`./adapters.md`](./adapters.md).
