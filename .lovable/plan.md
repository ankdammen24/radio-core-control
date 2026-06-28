# Radio Core — Podcast Hub

Ny modul som gör Radio Core till central distributionspunkt för podcasts mellan **Fablesh** (kreatörsplattform) och radiostationer (Radio Uppsala m.fl.). All ljudlagring/streaming sker i **Catalogus Media** — Radio Core lagrar endast metadata + referenser.

## Arkitektur

```text
Fablesh ──REST──▶ Radio Core (Podcast Hub) ──REST──▶ Radio Uppsala / andra stationer
                         │
                         └── refererar ljud i ──▶ Catalogus Media
```

Radio Uppsala anropar **aldrig** Fablesh eller RSS direkt. Allt går via Radio Core.

## Omfattning i denna iteration

Implementerar grundstommen — schema, sync-jobb, admin-UI, distribution-API och scheduler-integration. Avancerad statistik, granskning och multi-tenant publicering scaffoldas men markeras som vidareutveckling.

## 1. Databas (migration)

Nya tabeller (alla i `public` med GRANT + RLS):

- `podcast_sources` — externa källor (Fablesh-instanser). Fält: `id, name, kind ('fablesh'|'rss'), base_url, auth_secret_name, last_synced_at, sync_interval_minutes, is_active`.
- `podcasts` — synkade podcasts. Fält: `id, source_id, external_id, title, description, language, categories[], artwork_url, owner, last_updated_at, checksum, is_active`.
- `podcast_episodes` — avsnitt. Fält: `id, podcast_id, guid, title, description, publish_date, duration_seconds, explicit, season, episode_number, audio_url, artwork_url, transcript_url, checksum, version, deleted_at`.
- `station_podcast_subscriptions` — per station: vilka podcasts som är aktiva, regler. Fält: `id, station_id, podcast_id, priority, auto_import, manual_review, max_episodes, allow_explicit, only_swedish, only_owned, created_at`.
- `podcast_play_log` — uppspelningsstatistik. Fält: `id, station_id, episode_id, played_at, duration_played, source ('schedule'|'manual'|'live')`.
- `podcast_sync_runs` — kör-historik för diagnostik. Fält: `id, source_id, started_at, finished_at, podcasts_seen, episodes_new, episodes_updated, episodes_deleted, status, error`.

Index på `(podcast_id, guid)`, `(station_id, podcast_id)`, `(episode_id, played_at)`.

## 2. Server-side: sync från Fablesh

`src/lib/podcasts.functions.ts` (klientsäker, anropas från admin-UI):
- `listPodcasts`, `getPodcast`, `listEpisodes`, `listSources`, `upsertSource`, `triggerSync(sourceId)`, `refreshPodcast(podcastId)`, `listSubscriptions(stationId)`, `upsertSubscription`.

`src/server/podcast-sync.server.ts` (server-only):
- `syncSource(sourceId)` → GET `{base_url}/api/podcasts`, diff mot DB via `checksum`+`last_updated_at`, per podcast: GET `{base_url}/api/podcasts/{id}/episodes`, upsert/markera deleted via `guid`+`checksum`+`version`. Loggar i `podcast_sync_runs`.
- `fablesh-client.server.ts` — tunn fetch-klient, läser auth-token från Lovable Cloud-secret namngiven i `podcast_sources.auth_secret_name`.

Cron: ny rad i `/api/public/cron/podcast-sync` (TanStack server-route, anropas av `pg_cron` var 15:e minut), iterar aktiva källor och kallar `syncSource`.

## 3. Distribution-API (internt för stationer)

Nya TSS server-routes under `src/routes/api/public/stations.$stationId.*` (signaturverifierade med station-API-nyckel som lagras i `stations.api_key_hash`, ny kolumn):

- `GET /api/public/stations/{stationId}/podcasts` — podcasts som stationen prenumererar på.
- `GET /api/public/stations/{stationId}/podcasts/{podcastId}/episodes` — avsnittslista.
- `GET /api/public/stations/{stationId}/episodes/{episodeId}` — fullt avsnitt inkl. HLS/MP3-URL (refererar Catalogus Media direkt — Radio Core proxar inte ljud).
- `GET /api/public/stations/{stationId}/queue` — kommande schemalagda podcastblock.

Alla returnerar enbart metadata + ljud-URL:er som pekar mot Catalogus Media.

## 4. Scheduler-integration

Utöka befintliga `schedule_blocks` med `block_kind` (music|jingle|ad|live|news|**podcast**) och `podcast_selector` JSONB (`{ mode: 'latest'|'next_unplayed'|'random'|'season'|'category'|'tag'|'length', value?, max_duration_seconds? }`).

Server-fn `resolveScheduledPodcast(blockId, stationId)` plockar avsnitt enligt selector + `podcast_play_log` (för "next_unplayed").

## 5. Admin-UI under `/admin/podcasts/*`

Nya routes:
- `admin.podcasts.index.tsx` — lista podcasts, filter, search, "Sync now"-knapp per källa.
- `admin.podcasts.$id.tsx` — podcast-detalj: metadata, avsnitt, manuell refresh, sync-historik.
- `admin.podcast-sources.tsx` — CRUD för Fablesh-källor + secret-binding.
- `admin.podcast-subscriptions.tsx` — per station: välj podcasts, sätt regler (auto-import, max-avsnitt, explicit, prio).
- `admin.podcast-stats.tsx` — översikt: importerade, spelningar, top podcasts/avsnitt, felade syncs.

Återanvänder `AppLayout`, `ResourcePageShell`, `DataStates`, `StatusBadge`.

## 6. Publik podcastsida

Befintlig `src/routes/podcasts.tsx` byter placeholder mot riktig lista från `podcast_episodes` för aktiv station (via befintliga `getPublicStation` + ny `getPublicPodcasts(stationId)`). Klick öppnar avsnittsdetalj med inbäddad spelare som spelar `audio_url` (Catalogus Media).

## 7. Vad scaffoldas men inte byggs klart nu

- Manuell granskningskö (UI-skelett + DB-flagga, ingen workflow ännu).
- Avancerad statistik (basräknare ja, dashboards i v2).
- Multi-tenant rate limiting på distribution-API:t (token + log, throttling i v2).
- Transcript-rendering och kategoriöversikt på publik sida.

Markeras tydligt med `<PlaceholderNotice>`.

## 8. Säkerhet

- Fablesh-auth: secret per källa via `add_secret`-flödet (efter användarbekräftelse).
- Station-API: `Authorization: Bearer <station-key>`, jämförelse via `timingSafeEqual` mot `api_key_hash`.
- Inga ljudfiler proxas — bara metadata.
- RLS: admin/editor CRUD på alla nya tabeller; `service_role` för cron och distribution-routes.

## 9. Leveransordning

1. Migration (tabeller, grants, RLS, scheduler-utökning).
2. `podcasts.functions.ts` + `podcast-sync.server.ts` + Fablesh-klient.
3. Cron-route + `pg_cron`-schemaläggning.
4. Distribution-API (4 routes) + station-API-nyckel.
5. Admin-UI (5 routes).
6. Publik podcastsida.
7. Scheduler-integration + selector.

## Frågor innan vi börjar

1. **Fablesh-API**: är `/api/podcasts` och `/api/podcasts/{id}/episodes` på en `base_url` per Fablesh-instans korrekt? Ska jag förbereda för **både** Fablesh REST **och** generisk RSS som `kind` redan från start, eller bara Fablesh nu?
2. **Auth mot Fablesh**: Bearer-token i header, eller HMAC-signerad request? Vill du att vi konfigurerar token via secret nu (jag frågar då efter värdet), eller scaffoldar slot och fyller i senare?
3. **Catalogus Media-URL**: kommer `audio_url` från Fablesh redan vara den slutgiltiga HLS/MP3-URL:en mot Catalogus Media, eller behöver Radio Core anropa Catalogus separat (`POST /api/media/download` / `POST /api/podcast/import`) för att få tillbaka en streaming-URL?
4. **Station-auth mot distribution-API:t**: ny `stations.api_key_hash` + Bearer-token OK, eller vill du använda existerande mekanism (t.ex. Supabase service role per station)?
