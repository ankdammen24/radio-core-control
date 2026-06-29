# Radio Core — Broadcast Platform Implementation Plan

> Teknisk analys och implementationsplan för omvandlingen av Radio Core till ett
> komplett, AzuraCast-fritt broadcast-kontrollplan.
>
> Skriven: 2026-06-29
> Status: ANALYS & PLAN — ingen kod är ändrad ännu

---

## Del 1 — Teknisk analys

### 1.1 Vad som redan finns och fungerar

#### Infrastruktur och auth
- **`stack_tokens`** — hashing-baserat token-system (sha256). Används av runner, agents och public API. Korrekt arkitektur, behöver bara ett UI för att skapa tokens.
- **`agent_instances`** — tabell och UI för att registrera runtime-hosts. Har: name, station_id, hostname, version, capabilities, stack_token_id, status, last_seen_at. Korrekt struktur, heartbeat-endpointen saknas.
- **RLS och roller** — admin/editor/viewer-roller med station-scoped guards i alla public API:er. Fungerar bra.

#### Public API (runner-kontraktet)
- `GET /api/public/station-config` — returnerar `icecast_xml`, `liquidsoap_liq`, `playlists[]` baserat på DB. Autentiserat via `x-stack-token`. **Fungerar.**
- `POST /api/public/now-playing` — tar emot metadata från Liquidsoap-callback. **Fungerar.**
- `POST /api/public/health` — tar emot hälsorapporter från runner. **Fungerar.**
- `POST /api/public/listener-stats` — tar emot lyssnardata per mount. **Fungerar.**
- Podcast-feeds (`/api/public/stations/:id/podcasts/*`) — **fungerar.**

#### Config-generering
- `renderIcecastXml()` — genererar komplett icecast.xml. **Fungerar.**
- `renderLiquidsoapLiq()` — genererar radio.liq med playlist, fallback, live-input, now-playing-callback. **Fungerar men antar lokala filsökvägar i M3U.**
- `renderOutputsLiq()` — streaming-output-adapter. **Fungerar.**
- `generateStationConfig()` server-fn — sammansätter allt. **Fungerar.**

#### Docker och runner
- `runner/runner.py` — komplett Python-daemon. Pollar station-config, skriver filer, reloadar via telnet/SIGHUP, rapporterar hälsa och lyssnardata. **Fungerar.**
- `deploy/docker-compose.yml` — icecast, liquidsoap, runner med delade volymer. **Fungerar.**

#### Datamodell
- `icecast_configs` — hostname, port, lösenord, admin, max_clients. Komplett.
- `liquidsoap_configs` — crossfade, normalize_audio, telnet_host/port, custom_liq, generated_liq. Komplett.
- `stream_mounts` — mount_path, format, bitrate, is_default. Komplett.
- `streaming_outputs` — pluggbart adapter-system för Icecast-KH, Icecast, Shoutcast. Komplett.
- `live_inputs` — harbor_port, source_password, auto_takeover, fade-parametrar. Komplett.
- `fallback_tracks` — prioriterad fallback-lista. Komplett.
- `playlists` + `playlist_assignments` — spellistor med vikter och media-kopplingar. Komplett.
- `rotation_rules` — rotationsregler med timing, kategori, prioritet. Komplett.
- `schedule_blocks` — veckoschema med block_kind: music | jingle | ad | live | news | podcast. Delvis komplett — saknar koppling till broadcast_assets.
- `news_items` + `news_broadcast_history` — nyhetsmodul med statuses, audio_url, radio_script. Komplett men inte kopplad till sändningsflödet.
- `podcasts` + `podcast_episodes` + `station_podcast_subscriptions` — podcast-hub med Fablesh/RSS-synk. Komplett.
- `shows` + `rundown_items` — programmodul. Komplett.
- `now_playing` + `play_history` — realtid och historik. Komplett.
- `service_health` — hälsohistorik. Komplett.

---

### 1.2 Vad som måste förändras

#### A. Mediemodellen — det centrala problemet

`media_files` är idag designad för att synka filer till AzuraCast (lokal disk). Den innehåller `file_path` (lokal sökväg), `azuracast_media_id` och `storage_location_id` (FK till `storage_locations`). Liquidsoap-konfigen genererar M3U-filer med `/data/stations/{slug}/media/{file}` — lokala sökvägar.

Den nya modellen: **Liquidsoap hämtar media direkt från R2 via HTTP URL**. Liquidsoap stöder HTTP-URIer i playlists och via `request.dynamic`. Inga filer kopieras till VPS:en.

Detta kräver:
1. En ny tabell `broadcast_assets` (ersätter och utökar `media_files`)
2. Varje asset har `playback_url` (R2/CDN URL) som Liquidsoap använder direkt
3. `renderM3u()` genererar HTTP-URLer istället för lokala sökvägar
4. Liquidsoap-config behöver `enable_replaygain = false` eller hårdkodad normalisering när R2-streaming används (ingen lokal lufs-analys)

#### B. AzuraCast-kopplingar i datamodellen

Kolumner som måste tas bort (via migrationer):
- `media_files.azuracast_media_id`
- `playlists.azuracast_playlist_id`
- `stations.azuracast_station_id`
- `media_files.sync_dirty` (om den finns)
- Hela tabellen `azuracast_connections`

#### C. runtime_targets — konceptuell förvirring

Idag blandar `runtime_targets` ihop:
- Externa API:er Radio Core Web pollar (AzuraCast API) 
- Tjänster som runner hanterar lokalt (Icecast, Liquidsoap)

Med den nya arkitekturen ska `runtime_targets` representera **observationspunkter** — konfigurerbara health-probe-endpoints (Icecast status-JSON, Liquidsoap telnet). De är *inte* kontrollpunkter. Kontrollen sker via runnern.

Adaptrarna Icecast och Liquidsoap (redan stubs) är rätt approach. AzuraCast-adaptern tas bort.

#### D. schedule_blocks saknar asset-referens för news och voicetracks

`schedule_blocks` kan referera en `playlist_id` eller `rotation_rule_id`, men inte direkt ett nyhetsblock eller en voicetrack. För news-schemalägning behövs en `asset_id`-referens eller ett `news_selector`-fält (liksom det befintliga `podcast_selector`).

---

### 1.3 Vad som tas bort (AzuraCast-inventering)

#### Routes
| Fil | Åtgärd |
|-----|--------|
| `src/routes/azuracast.tsx` | Ta bort |

#### Server-funktioner och moduler
| Fil | Åtgärd |
|-----|--------|
| `src/lib/azuracast-runtime.functions.ts` | Ta bort |
| `src/server/azuracast-client.server.ts` | Ta bort |
| `src/server/runtime-adapters/azuracast.ts` | Ta bort |

#### Databastabeller och kolumner
| Objekt | Åtgärd |
|--------|--------|
| `azuracast_connections` (hel tabell) | DROP TABLE |
| `media_files.azuracast_media_id` | DROP COLUMN |
| `playlists.azuracast_playlist_id` | DROP COLUMN |
| `stations.azuracast_station_id` | DROP COLUMN |
| `runtime_target_type` enum-värde `azuracast` | REMOVE FROM ENUM |

#### Sync-jobb
| Jobb-typ | Åtgärd |
|----------|--------|
| `azuracast_sync` i `sync_jobs` | Ta bort job-handler |
| `azuracast.runtime.*` prefix i admin-only-gate | Ta bort |

#### UI-komponenter
| Komponent | Åtgärd |
|-----------|--------|
| SyncStatusBadge (azuracast_sync-status) | Anpassa till ny status-modell |
| Media-sidan: "Sync status (AzuraCast)"-kolumn | Ta bort |
| Playlist-sidan: `derivePlaylistSync()` med azuracast-logik | Ersätt |

---

### 1.4 Vad som kan återanvändas direkt (utan ändring)

- Hela `stack_tokens`-mekanismen
- `agent_instances` (används som runtime host-register)
- Hela `icecast_configs`-tabellen och `renderIcecastXml()`
- Hela `liquidsoap_configs`-tabellen och `renderLiquidsoapLiq()` (med URL-ändring)
- `streaming_outputs` + adapter-systemet
- `live_inputs` + live-takeover-systemet
- `fallback_tracks`
- `rotation_rules`
- `schedule_blocks` (med tillägg)
- `news_items` + `news_broadcast_history`
- Hela podcast-systemet
- `now_playing`, `play_history`, `listener_stats`, `service_health`
- `runner/runner.py` (med URL-ändring i apply_config)
- `deploy/docker-compose.yml` (med Stereo Tool-tillägg)
- Alla public API-endpoints utom station-config (behöver justering)

---

### 1.5 Vad som saknas

1. **`broadcast_assets`** — unified asset-tabell med `playback_url`, `asset_type`, `r2_key`, `loudness_lufs`, `duration_seconds` m.m.
2. **Heartbeat-endpoint** `POST /api/public/agent/heartbeat` — dokumenterat men ej implementerat
3. **Stack token UI** — admins skapar tokens direkt i DB idag
4. **`reload_requested_at`** på `agent_instances` — för att trigga omedelbar config-reload utan att vänta på poll-intervallet
5. **Stereo Tool i Docker Compose** — refereras i kommentarer men saknas som service
6. **`news_items` → Liquidsoap** — nyhetsblock schemaläggs men audio läses inte in i M3U
7. **`podcast_episodes` → Liquidsoap** — podcast-avsnitt spelas inte via Liquidsoap idag
8. **Liquidsoap HTTP-mode** — `renderM3u()` genererar lokala sökvägar; behöver HTTP-URLer

---

## Del 2 — Implementationsplan

### Principbeslut (inget kodas utan att dessa är fattade)

1. **Radio Core äger inte mediafiler.** Fablesh äger R2. Radio Core lagrar `playback_url` och `r2_key` som pekare.
2. **Ingen mediasynk i grundimplementationen.** Liquidsoap streamer direkt från R2 via HTTP. Lokal cache är en framtida optimering.
3. **En runner-process per station.** Docker Compose-stacken representerar exakt en station. Multi-station = fler Docker-stacks.
4. **`broadcast_assets` är Radio Cores medieregister.** Den ersätter `media_files` som primär tabell och inkluderar alla asset-typer.
5. **`agent_instances` är runtime host-registret.** Ingen ny tabell behövs — slå ihop med det befintliga konceptet.
6. **AzuraCast-kod tas bort i Fas 1** men databas-migrationer körs sist (för att inte bryta befintliga data).

---

### Fas 1 — AzuraCast-avveckling och städning

**Mål:** Rensa bort AzuraCast-kod utan att bryta existerande funktionalitet.

#### 1.1 Dölj AzuraCast-ytan i UI
- Ta bort `/azuracast`-länken från sidebaren
- Ta bort `azuracast`-alternativet ur `runtime_targets` typ-listan
- Dölj AzuraCast-kolumner i media- och playlist-listor (utan att radera data)
- Markera `azuracast`-relaterade server-fns som deprecated i kommentarer

#### 1.2 Ta bort AzuraCast-kod
- Radera `src/lib/azuracast-runtime.functions.ts`
- Radera `src/server/azuracast-client.server.ts`
- Radera `src/server/runtime-adapters/azuracast.ts`
- Radera `src/routes/azuracast.tsx`
- Ta bort `azuracast.runtime.*`-prefixet ur sync-job-admingaten

#### 1.3 DB-migration: ta bort AzuraCast-kolumner
```sql
-- Migration: remove_azuracast_coupling
ALTER TABLE media_files DROP COLUMN IF EXISTS azuracast_media_id;
ALTER TABLE playlists DROP COLUMN IF EXISTS azuracast_playlist_id;
ALTER TABLE stations DROP COLUMN IF EXISTS azuracast_station_id;
DROP TABLE IF EXISTS azuracast_connections;
-- Radera azuracast från runtime_target_type enum (kräver ny enum-typ i Postgres)
```

#### 1.4 Uppdatera TypeScript-typer och `media-kind.ts`
- Kör `supabase gen types` efter migrationer
- `media-kind.ts`: Utöka `MEDIA_KINDS` till det fullständiga settet (se Fas 2)

**Leverans:** AzuraCast-kod är borta. Ingen befintlig funktion är bruten.

---

### Fas 2 — Broadcast Assets

**Mål:** Ersätta `media_files` med en modern, asset-typ-baserad mediemodell som fungerar med R2-streaming.

#### 2.1 Ny tabell: `broadcast_assets`

```sql
CREATE TABLE broadcast_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id      uuid REFERENCES stations(id) ON DELETE SET NULL,
  
  -- Asset classification
  asset_type      text NOT NULL, -- music|podcast|jingle|toth|advertisement|sweeper|liner|voicetrack|news|program_segment|fx
  
  -- Identity
  title           text NOT NULL,
  artist_or_source text,
  
  -- Media reference (Radio Core never owns the file)
  r2_key          text,          -- Fablesh R2 object key (nullable för externa assets)
  playback_url    text NOT NULL, -- CDN/R2 URL som Liquidsoap använder
  mime_type       text,
  codec           text,
  
  -- Audio properties
  duration_seconds numeric,
  loudness_lufs   numeric,       -- EBU R128 integrated loudness
  waveform        jsonb,         -- Peaks för waveform-display
  
  -- Status
  is_active       boolean NOT NULL DEFAULT true,
  status          text NOT NULL DEFAULT 'ready', -- ready|processing|error|paused
  
  -- External references
  fablesh_id      text,          -- Fablesh asset ID om känt
  external_id     text,          -- Podcast GUID, news item ID etc.
  source_type     text,          -- 'fablesh'|'rss'|'local'|'news_hub'
  
  -- Rich metadata
  metadata        jsonb NOT NULL DEFAULT '{}',
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_assets_station_type ON broadcast_assets(station_id, asset_type);
CREATE INDEX idx_broadcast_assets_active ON broadcast_assets(is_active) WHERE is_active = true;
CREATE INDEX idx_broadcast_assets_fablesh ON broadcast_assets(fablesh_id) WHERE fablesh_id IS NOT NULL;
CREATE INDEX idx_broadcast_assets_external ON broadcast_assets(external_id) WHERE external_id IS NOT NULL;
```

**Asset-typer (fullständig lista):**
```
music           — Musikspår från Fablesh/R2
podcast         — Podcast-avsnitt (extern RSS eller Fablesh)
jingle          — Stationsidentitet, korta signaturljud
toth            — Top-of-the-hour: tidssignal, ID
advertisement   — Reklamspot
sweeper         — Övergångsljud, "music sweep"
liner           — Presentatörs-liner, rösttagg
voicetrack      — Förinspelat presentatörsinnehåll
news            — Nyhetsaudio (från Local News Hub eller egenproduktion)
program_segment — Del av ett program/show
fx              — Ljudeffekter
```

#### 2.2 Uppdatera `media-kind.ts`
```typescript
export const ASSET_TYPES = [
  "music", "podcast", "jingle", "toth", "advertisement",
  "sweeper", "liner", "voicetrack", "news", "program_segment", "fx"
] as const;
export type AssetType = typeof ASSET_TYPES[number];
```

#### 2.3 Migrera `playlist_assignments` till `broadcast_assets`
Lägg till kolumn `broadcast_asset_id` i `playlist_assignments` bredvid befintlig `media_file_id`. När migrationen är verifierad droppar vi `media_file_id`.

```sql
ALTER TABLE playlist_assignments ADD COLUMN broadcast_asset_id uuid REFERENCES broadcast_assets(id);
-- Backfill: mappa media_files → broadcast_assets för befintliga data
-- Sedan: DROP COLUMN media_file_id (efter verifiering)
```

#### 2.4 Migrera `fallback_tracks` och `rundown_items`
Samma mönster: lägg till `broadcast_asset_id`, backfill, verifiera, drop `media_file_id`.

#### 2.5 Uppdatera config-generering för HTTP-streaming

`renderM3u()` i `streaming.server.ts` genererar idag:
```
/data/stations/radio-uppsala/media/song.mp3
```

Ny output:
```
https://cdn.fablesh.com/media/abc123/song.mp3
```

Ändring i `generateStationConfig()` och `/api/public/station-config`:
```typescript
// Tidigare:
const files = assigns.map(a => `/data/stations/${station.slug}/media/${a.file_path}`);

// Ny:
const files = assigns.map(a => a.broadcast_assets?.playback_url).filter(Boolean);
```

Liquidsoap hanterar HTTP-URLer transparant i playlist-filer. Verifiera med Liquidsoap 2.x dokumentation att `playlist("/etc/liquidsoap/playlists/pl_0_rotation.m3u")` fungerar med HTTP-URLer — det gör det via `request.create`.

#### 2.6 UI: Assets-sida
Ny route `/assets` som ersätter `/media`. Visar `broadcast_assets` med filtrering på `asset_type`, station, status. Tillåter manuell registrering av en asset via `playback_url`.

**Leverans:** Broadcast_assets-tabellen är live. Playlists pekar på assets. Config genereras med HTTP-URLer. Liquidsoap streamer från R2.

---

### Fas 3 — Runner och Runtime Host

**Mål:** Komplettera runner-protokollet och göra runtime hosts first-class i UI:t.

#### 3.1 Heartbeat-endpoint

```typescript
// src/routes/api.public.agent.heartbeat.ts
POST /api/public/agent/heartbeat
x-stack-token: <secret>

Body:
{
  agent_id: string,           // UUID från agent_instances
  version: string,
  hostname: string,
  station_slug: string,
  capabilities: {
    liquidsoap: boolean,
    icecast: boolean,
    stereo_tool: boolean
  },
  metrics: {
    cpu_percent: number,
    mem_mb: number,
    uptime_seconds: number
  }
}

Response:
{
  ok: true,
  reload_requested: boolean,  // true = hämta config nu, ignorera poll-intervall
  config_version: string      // SHA256 av senaste genererade config
}
```

Endpoint:
1. Verifiera token via `stack_tokens`
2. Uppdatera `agent_instances`: `last_seen_at`, `status = 'online'`, `version`, `hostname`, `capabilities`
3. Rensa `reload_requested_at` om satt
4. Returnera `reload_requested: true` om `agent_instances.reload_requested_at IS NOT NULL`

#### 3.2 DB-ändring: reload trigger

```sql
ALTER TABLE agent_instances ADD COLUMN reload_requested_at timestamptz;
```

UI-knapp "Trigger reload" på runtime host-sidan sätter `reload_requested_at = now()`. Runner plockar upp vid nästa heartbeat och hämtar config omedelbart.

#### 3.3 Stack Token UI

Ny sida (under `/settings/tokens` eller `/admin/tokens`):
- Lista alla `stack_tokens`: namn, purpose, station, is_active, last_used_at
- Skapa ny token: generera `crypto.randomBytes(32).toString('hex')`, sha256-hasha, spara hash. Visa raw secret en gång.
- Återkalla: sätt `is_active = false`

Server-fn: `createStackToken({ name, purpose, station_id })` → returnerar `{ plaintext, id }`

#### 3.4 Runtime Targets — rensning och fokusering

Ta bort `azuracast`-typen. Behåll `icecast`, `liquidsoap`, `stereo_tool`, `custom`.

Ändra konceptet: runtime targets är nu **health-probe-konfigurationer** (t.ex. Icecast status-JSON URL). De är kopior av vad runnern hanterar, exponerade för observabilitet från kontrolplanet.

Lägg till `agent_instance_id` FK i `runtime_targets` för att koppla en target till dess host.

#### 3.5 Uppdatera runner.py för R2-streaming

Ta bort `MEDIA_DIR`-variabeln och all logik för lokal mediasynk.
`apply_config()` hanterar bara icecast.xml, radio.liq och m3u (med HTTP-URLer nu).

Lägg till heartbeat-loop:
```python
def heartbeat_loop():
    while not _shutdown.is_set():
        resp = requests.post(
            f"{API_URL}/api/public/agent/heartbeat",
            json={
                "agent_id": AGENT_ID,
                "version": VERSION,
                "hostname": socket.gethostname(),
                "station_slug": STATION_SLUG,
                "capabilities": {"liquidsoap": True, "icecast": True, "stereo_tool": STEREO_TOOL_ENABLED},
                "metrics": get_metrics()
            },
            headers=HEADERS_AUTH,
            timeout=10
        )
        data = resp.json()
        if data.get("reload_requested"):
            log.info("Reload requested from control plane — fetching config now")
            cfg = fetch_config()
            if cfg: apply_config(cfg)
        _shutdown.wait(HEARTBEAT_INTERVAL)
```

**Leverans:** Heartbeat fungerar. Tokens hanteras via UI. Reload kan triggras from Radio Core Web.

---

### Fas 4 — Schemaläggning med assets

**Mål:** Koppla schedule_blocks direkt till broadcast_assets och aktivera news + voicetracks i sändningsflödet.

#### 4.1 Utöka `schedule_blocks`

```sql
-- Ny referens: direkt asset (för voicetrack, toth, news-block)
ALTER TABLE schedule_blocks ADD COLUMN broadcast_asset_id uuid REFERENCES broadcast_assets(id);

-- Selector för news (liksom befintlig podcast_selector)
ALTER TABLE schedule_blocks ADD COLUMN news_selector jsonb;
-- Exempel: { "priority": ["breaking", "high"], "max_count": 3, "max_age_minutes": 60 }

-- Voicetrack-specifikt
ALTER TABLE schedule_blocks ADD COLUMN voicetrack_asset_id uuid REFERENCES broadcast_assets(id);
```

`schedule_block_kind`-enumet är redan korrekt: `music | jingle | ad | live | news | podcast`.

Lägg till: `voicetrack | toth | sweeper` för fullständig coverage.

#### 4.2 News-block i station-config

När `/api/public/station-config` genererar Liquidsoap-config, och ett schema-block är av typen `news`:
1. Hämta aktiva `news_items` med `status = 'ready_for_radio'` inom tidsfönstret
2. Välj assets med `asset_type = 'news'` i `broadcast_assets` kopplade till `news_items`
3. Generera en temporär M3U med news-audions `playback_url`
4. Liquidsoap-konfigen switchar till news-playlist vid rätt tid via `switch()` med time-guard

Alternativ enklare modell: news-audio returneras som en separat `news_playlist` i station-config-svaret. Runner skriver `news.m3u`. Liquidsoap använder time-based switch.

#### 4.3 Voicetrack-support

Voicetracks är `broadcast_assets` med `asset_type = 'voicetrack'`. De kan:
- Kopplas direkt till ett `schedule_block` (`voicetrack_asset_id`)
- Spelas via Liquidsoap `insert()` eller `request.queue`

I Liquidsoap-config: voicetracks läggs i en separat `request.queue`-source som matas av runnern via telnet vid rätt tidpunkt.

#### 4.4 Scheduler-UI

Utöka scheduler-formuläret:
- Block-typ "news" → visa news_selector-fält (prioritet, max antal, max ålder)
- Block-typ "voicetrack" → visa asset-picker filtrerad på `asset_type = 'voicetrack'`
- Block-typ "toth" → visa asset-picker filtrerad på `asset_type = 'toth'`

**Leverans:** Nyheter och voicetracks kan schemaläggas och spelas via Liquidsoap.

---

### Fas 5 — News Hub-integration

**Mål:** Local News Hub-nyheter konsumeras automatiskt och kan sändas.

#### 5.1 News Hub som källa

`news_items` stöder redan `source`, `external_id`, `audio_url`. Local News Hub är ännu en källa liksom RSS är för podcasts.

Lägg till en sync-mekanism (liksom `podcast_sync`):
- `news_hub_sources` tabell (name, endpoint_url, auth_secret_name, sync_interval_minutes)
- `news_hub_sync_runs` för sync-historik
- Cron-endpoint `POST /api/public/cron/news-sync` som hämtar från Local News Hub API och skapar/uppdaterar `news_items`

#### 5.2 Audio-generering för nyheter

När `news_items.audio_url` är satt (antingen från News Hub direkt, eller genererat via TTS):
1. Skapa/uppdatera en `broadcast_assets`-rad med `asset_type = 'news'`, `playback_url = audio_url`, `external_id = news_item.id`
2. Markera `news_items.status = 'ready_for_radio'`

Detta ger en ren separation: `news_items` hanterar redaktionellt innehåll, `broadcast_assets` hanterar playback.

#### 5.3 News API-endpoints

Befintliga endpoints:
- `GET /api/public/radio/news` ✅
- `GET /api/public/radio/news/:id` ✅
- `POST /api/public/radio/news/:id/broadcasted` ✅

Lägg till:
- `GET /api/public/radio/news/ready` — returnerar alla `ready_for_radio` nyheter med `audio_url`, sorterade på prioritet. Används av runner för att bygga news.m3u.

**Leverans:** Nyheter från Local News Hub hamnar automatiskt i sändningsflödet.

---

### Fas 6 — Podcast i broadcast-flödet

**Mål:** Podcast-avsnitt spelas live, schemaläggs och läggs i rotation utan duplicering.

#### 6.1 Podcast-episoder som broadcast_assets

När ett podcast-avsnitt importeras (via Fablesh eller RSS-synk):
```sql
INSERT INTO broadcast_assets (
  station_id, asset_type, title, artist_or_source,
  playback_url, duration_seconds, external_id, source_type, fablesh_id
)
VALUES (
  $station_id, 'podcast', $episode.title, $podcast.title,
  $episode.audio_url, $episode.duration_seconds, $episode.guid, 
  CASE WHEN podcast.source.kind = 'fablesh' THEN 'fablesh' ELSE 'rss' END,
  $episode.fablesh_id
);
```

Ingen duplicering av data — `broadcast_assets` är bara en **pekare** med `playback_url`.

#### 6.2 Podcast i spellistor och scheman

Med `broadcast_asset_id` i `playlist_assignments` kan podcast-avsnitt läggas direkt i en playlist. 

`schedule_blocks` med `block_kind = 'podcast'` och `podcast_selector` väljer avsnitt dynamiskt vid config-generering:
```jsonb
{ "podcast_id": "uuid", "max_episodes": 1, "order": "newest_first" }
```

#### 6.3 Podcast play log

Liquidsoap-callbacken `POST /api/public/now-playing` utökas: om `asset_type = 'podcast'` skrivs även ett `podcast_play_log`-event med `source = 'schedule'` eller `source = 'live'`.

**Leverans:** Podcasts spelas via samma Liquidsoap-flöde som musik, utan separata system.

---

### Fas 7 — Stereo Tool och Docker Compose

**Mål:** Komplett Docker Compose-stack för en production-station.

#### 7.1 Stereo Tool i Docker Compose

```yaml
stereo_tool:
  image: ${STEREO_TOOL_IMAGE:-busybox}  # byts ut mot riktig image
  container_name: radiocore-stereo-tool
  restart: unless-stopped
  volumes:
    - stereo-tool-config:/etc/stereo-tool
    - stereo-tool-presets:/opt/stereo-tool/presets
  environment:
    <<: *common-env
    STEREO_TOOL_LICENSE: ${STEREO_TOOL_LICENSE:-}
    STEREO_TOOL_PRESET: ${STEREO_TOOL_PRESET:-default}
  networks: [radiocore]
```

Stereo Tool körs som en separat process i pipeline-modellen:
```
Liquidsoap → [pipe] → Stereo Tool → [pipe] → Icecast
```

Alternativt som Liquidsoap-plugin om licensmodellen tillåter. Bestäm teknisk modell baserat på Stereo Tool-version.

#### 7.2 Stereo Tool-konfiguration i DB

```sql
ALTER TABLE liquidsoap_configs ADD COLUMN stereo_tool_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE liquidsoap_configs ADD COLUMN stereo_tool_preset text;
ALTER TABLE liquidsoap_configs ADD COLUMN stereo_tool_socket text DEFAULT '/tmp/stereo-tool.sock';
```

`renderLiquidsoapLiq()` anpassar output-pipeline baserat på `stereo_tool_enabled`.

#### 7.3 Runner hanterar Stereo Tool

Runner rapporterar Stereo Tool-hälsa:
```python
if STEREO_TOOL_ENABLED:
    report_health("stereo_tool", check_stereo_tool_process())
```

#### 7.4 Slutgiltig Docker Compose-struktur

```yaml
services:
  icecast:        # Icecast-KH, port 8000 externt
  liquidsoap:     # Savonet/liquidsoap:v2.2.5, telnet port 1234
  stereo_tool:    # Stereo Tool (pipe-modell eller plugin)
  runner:         # radiocore/runner, pollar Radio Core Web API

volumes:
  icecast-config:
  icecast-run:
  icecast-logs:
  liquidsoap-config:
  stereo-tool-config:
  stereo-tool-presets:
  # INGEN media-volym — allt streamas från R2
```

**Leverans:** Komplett, produktionsklar Docker Compose utan AzuraCast, MariaDB, nginx eller PHP.

---

### Fas 8 — Multi-station och skalbarhet

**Mål:** Arkitekturen klarar obegränsat antal stationer från samma kontrolplan.

#### 8.1 En Docker-stack per station

Varje station på sin VPS (eller sin service på en delad host med separata portar):

```
VPS Stockholm → Docker Compose → station: radio-uppsala, port 8000
VPS Göteborg  → Docker Compose → station: crystal-radio, port 8000
VPS Demo      → Docker Compose → station: demo-radio,    port 8000
```

Konfiguration via `.env`:
```bash
RADIO_CORE_STATION_SLUG=radio-uppsala
RADIO_CORE_STACK_TOKEN=<station-scoped-token>
ICECAST_PORT=8000
```

#### 8.2 Token-scoping

Station-scoped tokens kan bara läsa/skriva data för sin station. Redan implementerat via cross-tenant guards i alla public API-endpoints. Inget nytt att göra.

#### 8.3 Monitoring-dashboard

`/health`-sidan i Radio Core Web visar status för alla stationer och deras runtime hosts. `agent_instances` + `service_health` ger en aggregerad vy:

```
Radio Uppsala  ● online  icecast: ok  liquidsoap: ok  stereo_tool: ok
Crystal Radio  ● online  icecast: ok  liquidsoap: ok  stereo_tool: degraded
Demo Radio     ○ offline
```

#### 8.4 Accounts och white-label

`stations.account_id` → `accounts`-tabellen finns redan. Multi-tenant-stöd är förberett. Partnerstationer kan ges egna accounts med isolerade editors.

**Leverans:** Arkitekturen klarar 100+ stationer. Varje station är isolerad, self-contained och drivs av sin egen Docker-stack.

---

## Del 3 — Fas-tidslinje och prioritering

```
Fas 1: AzuraCast-avveckling      (2-3 dagar)   ← GÖR DETTA FÖRST
Fas 2: Broadcast Assets          (4-5 dagar)   ← Kritisk väg
Fas 3: Runner & Runtime Host     (3-4 dagar)   ← Parallell med Fas 2
Fas 4: Schemaläggning med assets (2-3 dagar)
Fas 5: News Hub-integration      (3-4 dagar)
Fas 6: Podcast i broadcast       (2-3 dagar)
Fas 7: Stereo Tool & Docker      (2-3 dagar)
Fas 8: Multi-station / skalning  (1-2 dagar)
```

Kritisk väg: **Fas 1 → Fas 2 → Fas 3 → Fas 7**

Det är allt som krävs för en fungerande, AzuraCast-fri broadcast-station. Fas 4-6 är värdefulla broadcast-features men inte blockande för grundflödet.

---

## Del 4 — Gränsdragning Radio Core / Fablesh

| Funktion | Radio Core | Fablesh |
|----------|-----------|---------|
| Musikbibliotek och uppladdning | ✗ | ✓ |
| Metadata-redigering | ✗ | ✓ |
| Artwork och omslag | ✗ | ✓ |
| Media-processing och loudness | ✗ | ✓ |
| Cloudflare R2-hosting | ✗ | ✓ |
| Creators och upphovsrätt | ✗ | ✓ |
| Podcast-publicering (RSS feed) | ✗ | ✓ |
| playback_url per asset | Konsumerar | Producerar |
| Playlist-kuration | ✓ | ✗ |
| Rotationsregler | ✓ | ✗ |
| Schemaläggning | ✓ | ✗ |
| Live-radio | ✓ | ✗ |
| Streaming-outputs | ✓ | ✗ |
| Now playing och historik | ✓ | ✗ |
| Hälsoövervakning | ✓ | ✗ |
| Nyhetsblock | ✓ | ✗ |
| Voicetracks (playback) | ✓ | ✗ |

Radio Core konsumerar `playback_url` från Fablesh. Fablesh producerar `playback_url` för Radio Core. Det är det enda API-kontraktet mellan systemen.

---

## Del 5 — API-kontrakt: runner ↔ Radio Core

### Endpoints runnern kallar

```
GET  /api/public/station-config?station={slug}   x-stack-token
     → icecast_xml, liquidsoap_liq, playlists[], news_playlist (NY)

POST /api/public/agent/heartbeat                  x-stack-token  (NY)
     → { reload_requested, config_version }

POST /api/public/now-playing                      x-stack-token
     → { station_slug, title, artist, album, mount, listeners, asset_type? }

POST /api/public/health                           x-stack-token
     → { service, status, message, details }

POST /api/public/listener-stats                   x-stack-token
     → { station_slug, mount, listeners, peak }
```

### Endpoints Radio Core Web kallar (via browser, inte runner)

```
GET  /api/public/health                           Bearer <jwt>
GET  /api/public/listener-stats?station={slug}   x-stack-token
```

### Token-hierarki

```
Global token    (station_id = NULL)  → läser/skriver alla stationer
Station token   (station_id = X)     → läser/skriver bara station X
```

---

*Planen är klar för implementation. Börja med Fas 1.*
