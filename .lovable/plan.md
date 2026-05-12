
# Full Azuracast-paritet i Radio Core

Mål: allt man kan göra via Azuracast API ska gå att göra härifrån. Radio Core är master — Azuracast-UI används inte för innehåll, bara för körning av broadcast.

## Princip

- En **typad Azuracast-klient** i `src/server/azuracast-client.server.ts` täcker hela API:et (genererad/handskriven wrapper kring REST-endpointsen).
- All I/O går via **TanStack server functions** (`createServerFn`) — inga nya edge functions om vi inte måste. De befintliga edge functions migreras gradvis till server fns.
- **Radio Core-databasen är källan**. Skrivningar går först till vår DB, sen pushas till Azuracast via en sync-pipeline (`sync_jobs`-tabellen finns redan).
- **Konfliktstrategi**: vid kollision vinner Radio Core. Pull från Azuracast används bara för "discovery" (initial import) och för read-only telemetri (now playing, listeners, history).
- **Per-station koppling**: `azuracast_connections` finns redan — varje station mappas till en Azuracast-instans + station-ID.

## Funktionsområden att bygga

Varje block = egen sida i sidomenyn + server fns + sync-job-typer.

### 1. Station runtime (drift)
- Now Playing live (har vi)
- Skip song, queue-hantering, manuell next-track
- Backend/frontend start/stop/restart
- Service-status (uptime, version, hälsa)

### 2. Media library (utbyggnad)
- Full CRUD (upload, replace, delete, edit metadata, albumart)
- Batch-operations (massuppdatera kategori, taggar, playlist-tillhörighet)
- Custom fields-stöd
- ID3-redigering med push till Azuracast

### 3. Playlists (utbyggnad)
- Full CRUD inkl. typ (default / scheduled / once-per-x-songs / once-per-x-minutes / once-per-hour / advanced)
- Vikter, schemaläggning per dag/tid, avoid-duplicates-regler
- Reshuffle, import från fil/M3U
- Koppling playlist↔media som push, inte pull

### 4. Streamers / DJs
- Ny modul: CRUD streamer-konton (användarnamn, lösenord, display-namn, art)
- Schema per streamer
- Broadcast-historik (vem sände när, längd)
- Live-takeover-koppling till befintlig `live_inputs`

### 5. Podcasts
- Ny modul: podcasts CRUD, episoder CRUD (redan har vi `episodes`/`shows` lokalt — koppla till Azuracast podcast-feeds)
- Feed-URL, kategorier, språk, författare
- Episode media + publish-status
- Auto-publicering vid klar episod

### 6. Mountpoints & remote relays
- CRUD mountpoints (har bas i `stream_mounts`) — push till Azuracast
- Intro-fil, fallback-mount, custom frontend config
- Remote relays (relay från extern källa)
- Listener-URL-generering

### 7. Webhooks
- Ny modul: lista, skapa, redigera Azuracast-webhooks (Discord, Twitter, Mastodon, generic, TuneIn, Radionomy m.fl.)
- Trigger-config + body-templates

### 8. Song Requests
- Vi har `song_requests`-tabell. Synka tvåvägs med Azuracast request-kö, godkänn/avvisa här.

### 9. Listeners & analytics
- Live listener-count per mount
- Historik per dag/timme/månad (befintlig `listener_stats` får mer data)
- Geo-fördelning, klient-fördelning (om data finns från AzuraCast)
- Export CSV

### 10. Admin (super-admin scope krävs)
- Users & roles i Azuracast (CRUD)
- Storage locations
- Settings (system-wide)
- Backups (lista, trigga, ladda ner)
- API-nycklar (lista, skapa, revokera)

## Datamodellen — vad behöver utökas

Lägger till `azuracast_*_id` kolumn där det saknas och nya tabeller för det vi inte har:

| Behov | Lösning |
|---|---|
| Streamers | Ny tabell `streamers` (user, pass, display, art, schedule i child-tabell) |
| Podcasts | Ny tabell `podcasts` + `podcast_episodes` (separat från befintliga interna `shows`/`episodes`) |
| Webhooks | Ny tabell `azuracast_webhooks` (type, config jsonb, triggers) |
| Remote relays | Ny tabell `remote_relays` |
| Custom fields (media) | Ny tabell `media_custom_fields` + `media_custom_values` |
| Mountpoint extras | Utöka `stream_mounts` (intro_path, fallback_mount, custom_listen_url) |
| Sync-status per resurs | Lägg `last_synced_at`, `sync_dirty` på alla synkbara tabeller |

Allt får RLS efter samma mönster som befintliga (select=auth, insert/update=editor, delete=admin).

## Sync-arkitektur

Generaliserad pipeline:

```text
UI mutation
   → server fn skriver till Radio Core DB (sync_dirty=true)
   → enqueue sync_job { type, station_id, payload }
   → worker (server fn anropad av pg_cron varje minut) plockar pending jobs
   → anropar Azuracast-klient
   → uppdaterar azuracast_*_id + sync_dirty=false, eller markerar failed
```

- **Pull-jobb** för read-only: now_playing, listeners, broadcasts-history. Schemaläggs via `pg_cron` mot `/api/public/cron/azuracast-pull`.
- **Push-jobb** triggas både direkt vid mutation (best effort) OCH av cron som retry.
- `sync_jobs`-sidan finns redan och visar status — får bredare job-typer.

## UI-struktur (sidomenyn efter)

Befintligt grupperas, nya markerade `(ny)`:

```text
Drift           Now Playing · Live · Listeners · Health
Innehåll        Media · Playlists · Voicetracks · Ads · Inbox
Sändning        Schemaläggning · Rotation · Fallback · Streaming · Streaming Outputs · Mountpoints (ny)
Program         Shows · Episoder · Streamers (ny) · Podcasts (ny)
Integrationer   Azuracast · Webhooks (ny) · Sync Jobs
Admin           Stationer · Konton · Användare · Roller · Storage · Konfig · Backup · Audit · Inställningar
```

## Bygg i etapper (förslag på ordning)

Hela paritet är stort. Föreslår 6 etapper, varje är en självständig leverans:

1. **Klient-fundament** — typad Azuracast-klient, generaliserat sync-pipeline, pg_cron, cron-endpoint
2. **Drift** — runtime-kontroll (skip/queue/restart), service-status, listeners live
3. **Media + Playlists fullt** — CRUD med push, batch, custom fields, intro/fallback
4. **Streamers + Podcasts** — nya tabeller, sidor, sync båda håll
5. **Mountpoints + Remote relays + Webhooks**
6. **Admin** — users/roles/storage/settings/backups/api-keys i Azuracast, song-request-sync

Vi börjar med etapp 1 efter ditt godkännande, levererar, går vidare till 2 osv. Säg till om du vill ändra ordning eller skippa något.

## Tekniskt (för dig som vill veta)

- Klienten lever i `src/server/azuracast-client.server.ts`, anropas bara från server fns i `src/server/*.functions.ts`.
- Befintliga edge functions (`azuracast-*`) migreras till server fns och tas bort. Edge function behålls bara om något kräver längre timeout eller står utanför TanStack-kontexten (t.ex. långa media-uppladdningar).
- Cron via `pg_net` mot `/api/public/cron/azuracast-pull` med apikey-header.
- API-nyckeln ligger redan som `AZURACAST_API_KEY`. Vid multi-instans flyttar vi till per-connection secret name (`api_key_secret_name` finns på `azuracast_connections`).
- Ingen ny extern dependency krävs.
