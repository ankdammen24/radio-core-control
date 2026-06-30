# Radio Core frontend migration

Last updated: 2026-06-30

## Migration rule

The Vercel frontend migrates one capability at a time. A capability only moves
to Radio Core Backend after its production route, authorization, validation and
error handling exist. Until then, the existing Supabase path remains active.

All Radio Core HTTP calls go through `src/lib/api`. Browser database access goes
through `src/services/database`; authentication goes through
`src/services/auth`. Components must not import provider SDKs directly.

## Current routing

### Phase 3 feature tracking

| Feature                        | Current source                         | New source                                           | Status        | Fallback                          | Next step                                                         |
| ------------------------------ | -------------------------------------- | ---------------------------------------------------- | ------------- | --------------------------------- | ----------------------------------------------------------------- |
| System health                  | Radio Core API                         | `GET /api/health`                                    | Migrated      | None; UI reports unavailable      | Add Redis/media/worker dependency checks                          |
| Stations (global read context) | Radio Core API                         | MongoDB `stations` via `GET /api/stations`           | API-first     | Supabase `stations`               | Add authenticated create/update/delete endpoints                  |
| Station detail read            | Radio Core API                         | MongoDB `stations` via `GET /api/stations/:id`       | Service ready | Supabase `stations`               | Adopt in detail/edit views after write parity                     |
| Station administration writes  | Supabase                               | Radio Core API                                       | Not migrated  | Existing Supabase behavior        | Add authorization, audit and CRUD routes                          |
| Media status aggregate         | Radio Core API                         | MongoDB `media_assets` via `GET /api/media/status`   | API-first     | Supabase `media_files` aggregate  | Populate Mongo from upload/processing pipeline                    |
| Media library and metadata     | Supabase                               | Radio Core API                                       | Not migrated  | Existing Supabase behavior        | Add paginated media and metadata routes                           |
| Public config (read-only)      | Radio Core API                         | MongoDB `system_config` via `GET /api/config/public` | API-first     | Supabase `system_settings.public` | Add schema versioning and cache invalidation                      |
| Settings writes                | Supabase                               | Radio Core API                                       | Not migrated  | Existing Supabase behavior        | Add authenticated config write routes                             |
| Authentication/login           | Supabase Auth                          | Radio Core                                           | Not migrated  | Existing login                    | Implement production backend session validation                  |

MongoDB initialization creates validated `stations`, `media_assets` and
`system_config` collections, indexes them and upserts the Radio Uppsala seed.
Set `RADIO_UPPSALA_STATION_ID` to the existing Supabase station UUID during the
transition so API reads and Supabase writes address the same station.

The migration status view at `/migration-status` displays provider reachability,
the active source for each migrated read and the reason whenever fallback is in
use.

| Category       | Current provider                                                                           | Radio Core support                                          | Next migration step                                          |
| -------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Authentication | Supabase Auth through `AuthService` | `/auth/*` is development-only and returns 501 in production | Implement production session validation before switching |
| Users          | Supabase (`profiles`, `user_roles`, `accounts`)                                            | No production route                                         | Add `/api/users`, roles and account authorization            |
| Radio Stations | Radio Core for global reads; Supabase for writes and remaining views                       | Read endpoints implemented                                  | Add authenticated station writes and station scoping         |
| Playlists      | Supabase (`playlists`, `playlist_assignments`, `rotation_rules`)                           | No route                                                    | Add playlist and rotation routes                             |
| Podcasts       | Supabase (`podcasts`, podcast sources/subscriptions)                                       | No route                                                    | Add podcast catalogue and sync routes                        |
| Episodes       | Supabase (`episodes`, `podcast_episodes`, `shows`, `rundown_items`)                        | No route                                                    | Add episode/show/rundown routes                              |
| Media          | Radio Core for status aggregate; Supabase metadata plus R2/storage services                | Status endpoint implemented                                 | Add API metadata routes before moving reads/writes           |
| Uploads        | Supabase/R2 server functions                                                               | Media upload endpoints are TODO                             | Implement signed upload/finalize endpoints                   |
| Scheduling     | Supabase (`schedule_blocks`, `live_takeover_schedule`)                                     | Scheduler jobs are placeholders                             | Add schedule CRUD and executable jobs                        |
| Settings       | Radio Core for public config; Supabase for writes and private settings                     | Public read endpoint implemented                            | Add typed authenticated settings routes and secret handling  |
| Statistics     | Supabase (`listener_stats`, `play_history`, `now_playing`, health tables)                  | No route                                                    | Add read APIs and retention policy                           |
| Backend health | **Radio Core API** via `GET /health` and `GET /api/health`                                 | Production routes exist                                     | Add remaining dependency probes                              |

## Still on Supabase

The following domains intentionally remain on Supabase in this phase:

- accounts, profiles, user roles and authentication sessions;
- station writes, streaming configuration, runtime targets and agents;
- media library/metadata, storage metadata, playlists and rotations;
- podcasts, episodes, shows, rundowns and news;
- scheduling, live takeover, ads, requests and studio messages;
- now-playing, play history, listener statistics, audit and service health;
- AzuraCast legacy data while its replacement remains incomplete.

Supabase is a real provider, not a stub. Browser credentials use
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; trusted server functions use
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Using Radio Core Backend

- `GET /health`, `GET /api/health`, station reads, media status and public config
  through the central API client.
- Base URL comes only from `VITE_API_URL`. Production should set it to the Nginx
  gateway, `https://api.radiouppsala.se`.
- Cross-domain cookies are enabled by the API client with
  `credentials: "include"` for future staged route migrations.

## Route migration checklist

Before changing a domain from Supabase to Radio Core:

1. Implement and test the production API route behind Nginx.
2. Match existing RLS behavior with API authorization and station scoping.
3. Add the domain service using `src/lib/api`.
4. Preserve the Supabase adapter as a rollback path during rollout.
5. Switch the service implementation, not individual components.
6. Verify Vercel CORS, cookies, errors and loading states.
7. Update this document.
