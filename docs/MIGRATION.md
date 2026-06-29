# Radio Core frontend migration

Last updated: 2026-06-29

## Migration rule

The Vercel frontend migrates one capability at a time. A capability only moves
to Radio Core Backend after its production route, authorization, validation and
error handling exist. Until then, the existing Supabase path remains active.

All Radio Core HTTP calls go through `src/lib/api`. Browser database access goes
through `src/services/database`; authentication goes through
`src/services/auth`. Components must not import provider SDKs directly.

## Current routing

| Category       | Current provider                                                                           | Radio Core support                                          | Next migration step                                          |
| -------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Authentication | Supabase Auth through `AuthService`; Auth0 configuration retained behind the auth boundary | `/auth/*` is development-only and returns 501 in production | Implement production sessions/Auth0 adapter before switching |
| Users          | Supabase (`profiles`, `user_roles`, `accounts`)                                            | No production route                                         | Add `/api/users`, roles and account authorization            |
| Radio Stations | Supabase (`stations`, runtime configuration tables)                                        | No route                                                    | Add `/api/stations` CRUD and station scoping                 |
| Playlists      | Supabase (`playlists`, `playlist_assignments`, `rotation_rules`)                           | No route                                                    | Add playlist and rotation routes                             |
| Podcasts       | Supabase (`podcasts`, podcast sources/subscriptions)                                       | No route                                                    | Add podcast catalogue and sync routes                        |
| Episodes       | Supabase (`episodes`, `podcast_episodes`, `shows`, `rundown_items`)                        | No route                                                    | Add episode/show/rundown routes                              |
| Media          | Supabase metadata plus R2/storage services                                                 | Media process is scaffolded, not production-ready           | Add API metadata routes before moving reads/writes           |
| Uploads        | Supabase/R2 server functions                                                               | Media upload endpoints are TODO                             | Implement signed upload/finalize endpoints                   |
| Scheduling     | Supabase (`schedule_blocks`, `live_takeover_schedule`)                                     | Scheduler jobs are placeholders                             | Add schedule CRUD and executable jobs                        |
| Settings       | Supabase (`system_settings`, streaming/storage/runtime tables)                             | No route                                                    | Add typed settings routes and secret handling                |
| Statistics     | Supabase (`listener_stats`, `play_history`, `now_playing`, health tables)                  | No route                                                    | Add read APIs and retention policy                           |
| Backend health | **Radio Core API** via `GET /health`                                                       | Production route exists                                     | Complete; frontend displays availability                     |

## Still on Supabase

The following domains intentionally remain on Supabase in this phase:

- accounts, profiles, user roles and authentication sessions;
- stations, streaming configuration, runtime targets and agents;
- media metadata, storage metadata, playlists and rotations;
- podcasts, episodes, shows, rundowns and news;
- scheduling, live takeover, ads, requests and studio messages;
- now-playing, play history, listener statistics, audit and service health;
- AzuraCast legacy data while its replacement remains incomplete.

Supabase is a real provider, not a stub. Browser credentials use
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; trusted server functions use
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Using Radio Core Backend

- `GET /health` through the central API client.
- Base URL comes only from `VITE_API_URL`. Production should set it to the Nginx
  gateway, `https://api.radiouppsala.se`.
- Cross-domain cookies are enabled by the API client with
  `credentials: "include"` for future staged route migrations.

## Auth0 status

No direct Auth0 SDK usage existed in the repository when this phase started.
The required Auth0 environment configuration is now isolated in
`src/services/auth/auth0.ts`. Supabase remains the active `AuthService` adapter
until the existing Vercel Auth0 bootstrap can be connected to the same contract.
Components do not call Auth0 or Supabase Auth directly.

## Route migration checklist

Before changing a domain from Supabase to Radio Core:

1. Implement and test the production API route behind Nginx.
2. Match existing RLS behavior with API authorization and station scoping.
3. Add the domain service using `src/lib/api`.
4. Preserve the Supabase adapter as a rollback path during rollout.
5. Switch the service implementation, not individual components.
6. Verify Vercel CORS, cookies, errors and loading states.
7. Update this document.
