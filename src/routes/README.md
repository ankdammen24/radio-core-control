# src/routes — Frontend UI + Public API Endpoints

This directory contains all TanStack Start route files. Every file here is either a
**React page** (admin UI or public page) or an **HTTP endpoint** (public API or cron).

## Architecture layer

`src/routes` is the **Frontend / API surface** layer of Radio Core.

- React pages (`*.tsx`) → rendered in the browser, use Supabase anon client with RLS
- API routes (`api.public.*.ts`) → HTTP handlers for the runner and external consumers
- API routes (`api.public.cron.*.ts`) → HTTP handlers for scheduled background work

For privileged server logic, pages call `createServerFn` handlers defined in `src/lib/*.functions.ts`
or `src/server/`. They do **not** import `supabaseAdmin` or server-only secrets directly.

## File naming convention

| Pattern | Description |
|---------|-------------|
| `__root.tsx` | Root layout and provider tree |
| `index.tsx` | Landing / dashboard |
| `<name>.tsx` | Admin UI page (e.g., `playlists.tsx`, `agents.tsx`) |
| `api.public.<name>.ts` | Public HTTP endpoint (runner API, external consumers) |
| `api.public.cron.<name>.ts` | Cron-triggered background work (authenticated via `CRON_SECRET`) |

## Page inventory

### Operate
- `cockpit.tsx` — Studio Cockpit (live control panel)
- `now-playing.tsx` — Current track display
- `live.tsx` — Live / takeover controls
- `listeners.tsx` — Listener count and stats
- `health.tsx` — Service health dashboard

### Content
- `media.tsx` — Media library (music, jingles, etc.)
- `playlists.tsx` — Playlist management
- `voicetracks.tsx` — Voicetrack management
- `ads.tsx` — Advertisement management
- `inbox.tsx` — Incoming content inbox
- `news.tsx` — Local News Hub
- `files.tsx` — File browser
- `r2-storage.tsx` — R2 object storage browser
- `episodes.tsx` — Podcast episode management
- `podcast-hub.tsx` — Podcast subscription and sync hub
- `podcasts.tsx` — Podcast library
- `programs.tsx` — Program management
- `shows.tsx` — Show management

### Schedule
- `scheduler.tsx` — Weekly schedule builder
- `rotation.tsx` — Rotation rule management
- `fallback.tsx` — Fallback/emergency stream config
- `schedule.tsx` — Schedule overview

### Streaming
- `streaming-outputs.tsx` — Output configuration (Icecast mounts, HLS, etc.)
- `streaming.tsx` — Liquidsoap / Icecast config viewer and generator

### Integrations
- `runtime-targets.tsx` — Runtime target CRUD (Icecast, Liquidsoap, Stereo Tool)
- `agents.tsx` — Agent instance management and stack-token pairing
- `sync-jobs.tsx` — Background sync job viewer

### Admin
- `stations.tsx` — Station management
- `accounts.tsx` — Account management
- `users.tsx` — User management
- `storage.tsx` — Storage configuration
- `storage-targets.tsx` — Storage adapter targets
- `configs.tsx` — Config viewer
- `settings.tsx` — Application settings
- `backup.tsx` — Backup management
- `audit.tsx` — Audit log

### Public API endpoints
- `api.public.station-config.ts` — `GET /api/public/station-config` (runner polls this)
- `api.public.now-playing.ts` — `GET/POST /api/public/now-playing`
- `api.public.health.ts` — `GET/POST /api/public/health`
- `api.public.listener-stats.ts` — `POST /api/public/listener-stats`
- `api.public.radio.news.ts` — `GET /api/public/radio/news`
- `api.public.radio.news.$id.ts` — `GET /api/public/radio/news/:id`
- `api.public.radio.news.$id.broadcasted.ts` — `POST /api/public/radio/news/:id/broadcasted`
- `api.public.stations.$stationId.podcasts.ts` — Podcast listing
- `api.public.stations.$stationId.podcasts.$podcastId.episodes.ts` — Episode listing
- `api.public.stations.$stationId.episodes.$episodeId.ts` — Episode detail

### Cron endpoints
- `api.public.cron.podcast-sync.ts` — Scheduled podcast RSS sync
- `api.public.cron.sync-worker.ts` — Background sync worker trigger

## Legacy files

- `azuracast.tsx` — **LEGACY** AzuraCast connection management UI.
  Hidden from navigation. Do not extend. Will be removed in a future phase
  after `azuracast_connections` data is migrated or retired.
  See: `docs/architecture/radio-core-v2.md` §3 (AzuraCast phase-out plan)
