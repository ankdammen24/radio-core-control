# Radio Core frontend migration

Last updated: 2026-06-30

## Migration rule

The Vercel frontend migrates one capability at a time. A capability only
moves to the Radio Core API after its production route, authorization,
validation and error handling exist. Until then, the existing Supabase path
remains active.

The Radio Core API now runs as TanStack Start server routes under
`/api/v1/*` in this same Vercel deployment, backed by Postgres via Drizzle
(`src/server/db`, `src/server/repositories`) — there is no separate backend
server. All Radio Core HTTP calls from the browser go through
`src/lib/api` and the `*Api.ts` service modules in `src/services/`.
Components must not import provider SDKs (Supabase client, Drizzle) directly.

## Current routing

| Feature   | Source              | Endpoints                                                                 | Status    |
| --------- | -------------------- | -------------------------------------------------------------------------- | --------- |
| Stations  | Postgres via Drizzle  | `/api/v1/stations`, `/api/v1/stations/:id`                                 | Migrated  |
| Media     | Postgres via Drizzle  | `/api/v1/media`, `/api/v1/media/:id`                                       | Migrated  |
| Playlists | Postgres via Drizzle  | `/api/v1/playlists`, `/api/v1/playlists/:id`, `/api/v1/playlists/:id/items`| Migrated  |
| Podcasts  | Postgres via Drizzle  | `/api/v1/podcasts`, `/api/v1/podcasts/:id`, `/.../episodes`                | Migrated  |
| Settings  | Postgres via Drizzle  | `/api/v1/settings/global`, `/api/v1/settings/stations/:stationId`          | Migrated  |
| System health | Postgres + Supabase (mixed) | `/api/public/health`                                                 | Migrated  |

These five domains' admin UI (`stations.tsx`, `media.tsx`, `playlists.tsx`)
reads/writes through the `*Api.ts` services above, not Supabase.

## Still on Supabase

The following domains intentionally remain on Supabase (JS client) in this
phase — no Postgres/Drizzle route exists for them yet:

- accounts, profiles, user roles and authentication sessions;
- AzuraCast connection config, runtime targets and agents;
- podcast *sources*/sync (Fablesh integration — distinct from the manual
  podcasts/episodes CRUD above, see `podcast-hub.tsx`);
- live broadcast scheduling — shows, episodes (rundown planner, not podcast
  episodes), rundown items, requests, studio messages;
- streaming configuration (icecast/liquidsoap configs, stream mounts,
  streaming outputs), now-playing, play history, listener statistics;
- station branding fields (`accent_color`, `slogan`, `public_url` — not yet
  in the `stations` Postgres table);
- audit log, news, ads, tokens, backup, sync-worker, storage targets.

Supabase is a real provider, not a stub, for these. Browser credentials use
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; trusted server functions
use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Using the Radio Core API

- Base URL: same-origin by default (`/api/v1/*`). Set `VITE_API_URL` only to
  point at an externally hosted gateway instead.
- `DATABASE_URL` (Postgres) is the only required server-side variable — see
  `docs/VERCEL.md`.

## Route migration checklist

Before moving a domain from Supabase to the Radio Core API:

1. Add/extend the Drizzle schema in `src/server/db/schema/`.
2. Add repository functions in `src/server/repositories/`.
3. Add a TanStack Start server route under `src/routes/api.v1.*.ts`
   returning the `{success,data}`/`{success,error}` envelope.
4. Add a typed `*Api.ts` service in `src/services/`.
5. Switch the consuming component(s) to the new service, preserving the
   existing component field names via a mapper if they differ.
6. Run `npm run db:push` against `DATABASE_URL` to apply schema changes.
7. Update this document.
