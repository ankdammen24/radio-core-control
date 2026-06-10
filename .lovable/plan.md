
# Plan: Adapt broadcast-core spec into Radio Core (React/TanStack)

The spec is Vue-based; we'll implement it as **React 19 + TanStack Start + Tailwind v4** to match this project. No backend work — we wire everything to existing `createServerFn` modules and `/api/public/*` routes already in `src/lib/` and `src/routes/`. All branding stays white-label and station-driven (per project memory) — Radio Uppsala only appears as seed data.

## 1. Public listener site (new)

New routes under `src/routes/`:

```text
index.tsx              -> hero + large player + now playing + recently played + schedule preview
listen.tsx             -> full-page player experience, stream picker
schedule.tsx           -> calendar + list view (read-only)
programs.tsx           -> program grid
programs.$slug.tsx     -> program detail
podcasts.tsx           -> podcast listing (placeholder data source)
podcasts.$slug.tsx     -> episodes list
about.tsx
contact.tsx
```

Each route gets its own `head()` meta (title, description, og:*). Index is the only one with og:image.

New layout: `src/components/public-layout.tsx` (top nav, footer, theme toggle, mini-player slot). Distinct from the existing `AppLayout` (which stays for `/admin`).

Data sources (already exist):
- `/api/public/now-playing` → Now Playing + Recently Played
- `/api/public/station-config` → station branding, stream URLs, mountpoints
- `/api/public/listener-stats` → optional listener counts
- `src/lib/streaming.functions.ts` / `streaming-outputs.functions.ts` → stream profile list
- Schedule: read via a new public server fn that wraps the existing scheduler queries (read-only, `supabaseAdmin` projection of safe columns).

## 2. Persistent radio player

- `src/lib/player-context.tsx` — React context with a singleton `<audio>` element mounted once in `__root.tsx`, so playback survives route changes.
- `src/components/radio-player.tsx` — large player (hero/listen page).
- `src/components/mini-player.tsx` — fixed bottom bar, appears after first play; rendered in `public-layout`.
- HLS via `hls.js` (lazy-loaded, client-only); native MP3/AAC fallback.
- Stream picker: Auto (HLS) / AAC 48 / AAC 96 / AAC 192 / MP3 192 — sourced from station-config; gracefully hidden if a profile is missing.
- States: loading, error, fallback artwork. Mobile = expanded sheet; desktop = inline + mini.

## 3. Admin shell under `/admin/*` (new, parallel)

Per your choice, we build a **new** admin tree. To avoid duplicating server logic, each new admin page calls the same `*.functions.ts` modules the current pages use (no new backend). The existing top-level pages (`/stations`, `/playlists`, …) stay in place; we can hide them from the sidebar later if you want.

```text
admin/login.tsx              -> wraps existing /auth flow
admin/route.tsx              -> _authenticated-style guard + AdminLayout sidebar
admin/index.tsx              -> Dashboard: station/icecast/liquidsoap status, now-playing,
                                current playlist + block, recent logs,
                                action buttons (Reload Liquidsoap, Generate Config,
                                Restart Services, Refresh Status) → existing
                                streaming.server / runtime-targets / agent-client fns
admin/stations.tsx           -> list + editor (name, slug, domain, description,
                                website, branding, default artwork)
admin/playlists.tsx          -> CRUD + drag-and-drop ordering (dnd-kit),
                                playlist types incl. toth/sponsor/fallback
admin/tracks.tsx             -> search/filter table, upload + R2 + Catalogus
                                Musicus placeholders
admin/schedules.tsx          -> calendar + list, recurring + priorities,
                                current/upcoming block markers
admin/programs.tsx           -> CRUD
admin/podcasts.tsx           -> podcasts + episodes nested
admin/live.tsx               -> live input status, DJs, override/fallback,
                                connection info (passwords masked)
admin/streams.tsx            -> mountpoints, HLS profiles, public URLs,
                                copy + test buttons
admin/settings.tsx
admin/logs.tsx               -> filter by source, severity badges, refresh
```

Auth: reuse existing `src/lib/auth.tsx`. Admin routes go under a new
`src/routes/_authenticated/admin.*` tree using the integration-managed
`_authenticated` layout (no custom auth gate).

## 4. Shared components (new)

`AdminLayout`, `PublicLayout`, `RadioPlayer`, `MiniPlayer`, `NowPlayingCard`,
`RecentlyPlayedList`, `SchedulePreview`, `PodcastCard`, `DashboardStatusCards`,
`PlaylistEditor`, `TrackTable`, `ScheduleEditor`, `LiveStatusPanel`,
`StreamUrlsPanel`, `LogsTable`, `ThemeToggle` (already exists in theme.tsx — reuse).

## 5. Design tokens & theming

- Stay on existing oklch tokens in `src/styles.css`; add `--gradient-hero`,
  `--shadow-player`, `--radius-player` for the Spotify/Apple-feel player.
- Dark mode already wired via `ThemeProvider`. Mobile-first via Tailwind v4.
- No station-specific colors hardcoded — accent comes from
  `stations.accent_color` (already in `StationBrand`).

## 6. Out of scope (placeholders only)

News section, Catalogus Musicus import, Cloudflare R2 uploader UI, RSS feed,
AI presenters, premium memberships, listener analytics dashboards, mobile
apps. Each gets a `<PlaceholderNotice>` card pointing to where the integration
will plug in.

## 7. Delivery order

1. Player context + audio singleton + mini/large player + `hls.js` install.
2. PublicLayout + `/`, `/listen` wired to `/api/public/*`.
3. `/schedule`, `/programs`, `/podcasts`, `/about`, `/contact` with route-level `head()`.
4. AdminLayout + `/admin` dashboard wired to existing server fns.
5. Remaining `/admin/*` pages, reusing current `.functions.ts` modules.
6. Polish: empty/loading/error states everywhere, mobile sheet player.

No DB migrations. No new edge functions. No changes to existing
`src/integrations/supabase/*` files.
