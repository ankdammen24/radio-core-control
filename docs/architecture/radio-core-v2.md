# Radio Core v2 — Arkitektur och Roadmap

> Version: 2.0-draft  
> Datum: 2026-06-29  
> Status: Gällande arkitekturbeslut — roadmap under aktiv implementation

---

## 1. Vision

Radio Core är ett **broadcast control plane** för professionell radio. Det är inte ett mediabibliotek, inte en streaming-server och inte en AzuraCast-klon. Det är kontrollplanet som orchestrerar alla dessa delar.

**Kärnprincip:** Radio Core vet vad som ska spelas, när det ska spelas och hur det ska distribueras — men utför aldrig uppspelningen själv.

```
Fablesh          Radio Core         Runtime VPS
(media origin)   (control plane)    (broadcast engine)

R2/CDN ──────── playback_url ──────► Liquidsoap ──► Icecast ──► Lyssnare
         metadata only               (spelar via HTTP)
```

Radio Core äger aldrig mediafiler. Det äger definitionen av hur media används i sändning.

---

## 2. Plattformens tre lager

### 2.1 Lager 1 — Fablesh: Media Origin

Fablesh är det centrala medieekosystemet. Radio Core konsumerar Fablesh, det konkurrerar inte med det.

**Fablesh äger:**
- Musikbibliotek (filer, metadata, artwork)
- Podcast-publicering och RSS-feeds
- Media-processing (loudness normalization, transcoding)
- Creators och upphovsrätt
- Cloudflare R2 (all objektlagring)

**Fablesh exponerar mot Radio Core:**
- `playback_url` per media-asset (CDN-URL som Liquidsoap kan hämta direkt)
- `duration_seconds`, `loudness_lufs`, `codec`, `mime_type`
- Podcast-avsnitt via Fablesh API eller RSS

**Radio Core tar emot och lagrar:**
- `playback_url` — den enda referensen Radio Core behöver
- Metadata för search/filter i UI
- Koppling till stationer, spellistor och scheman

Radio Core duplikerar aldrig mediafiler. Den kopierar inte filer till VPS:en.

### 2.2 Lager 2 — Radio Core: Broadcast Control Plane

Radio Core Web är en TanStack Start fullstack-app med tre distinkta underroller:

#### Frontend / UI
React-komponenter som hanterar:
- Admin-gränssnitt (playlists, rotation, schema, assets)
- Cockpit (live-kontroll, now-playing, health)
- Public views (listener-appen, schema-sida, programguide)
- Auth via Supabase (JWT, roller: admin/editor/viewer)

Direkt Supabase-access är normalt — RLS är säkerhetslagret.

#### Backend / API
Server-side logik som hanterar:
- `createServerFn` — privilegierade operationer som kräver hemliga credentials
- `api/public/*` HTTP-routes — runnerns API-kontrakt
- Config-generering (Icecast XML, Liquidsoap `.liq`, M3U-spellistor)
- Token-autentisering (stack_tokens, sha256-hashing)
- Integrationer (Fablesh API, R2, podcast-synk, news hub)

Använder `supabaseAdmin` (service role) för operationer som kräver RLS-bypass.

#### Runtime Bridge
Gränssnitt mot broadcast-VPS:en:
- Exponerar `GET /api/public/station-config` — ger runnern sin konfiguration
- Tar emot `POST /api/public/agent/heartbeat` — runtime-status
- Tar emot `POST /api/public/now-playing` — metadata från Liquidsoap
- Tar emot `POST /api/public/health` — hälsostatus per service
- Tar emot `POST /api/public/listener-stats` — lyssnardata

### 2.3 Lager 3 — Runtime VPS: Broadcast Engine

En fristående VPS med Docker Compose. Kommunicerar **endast** med Radio Core Web via HTTP. Känner inte till Supabase, R2-credentials eller interna system.

**Komponenter:**
- **Runner** — stateless Python-daemon, orchestrerar allt
- **Liquidsoap** — audio-motor, hämtar media via HTTP från R2/CDN
- **Icecast-KH** — streaming-distribution till lyssnare
- **Stereo Tool** — professionell ljudprocessering (optional)

**Principen: Runner är den enda som kommunicerar med Radio Core.**
Liquidsoap, Icecast och Stereo Tool känner inte till Radio Core.

---

## 3. AzuraCast: Avvecklingsplan

AzuraCast fasas ut i sin helhet. Det är ett system som Radio Core tidigare delegerade sändningskontroll till. I den nya arkitekturen hanterar Radio Core + Runner den rollen direkt.

### Vad som är AzuraCast-specifikt (identifierat)

**Kod att ta bort:**
```
src/lib/azuracast-runtime.functions.ts    — direkta AzuraCast API-anrop
src/server/azuracast-client.server.ts     — AzuraCast HTTP-klient
src/server/runtime-adapters/azuracast.ts  — runtime-adaptern
src/routes/azuracast.tsx                  — admin-UI för AzuraCast-kontroll
```

**Databas att migrera bort:**
```
azuracast_connections (hel tabell)        — DROP
media_files.azuracast_media_id            — DROP COLUMN
playlists.azuracast_playlist_id           — DROP COLUMN
stations.azuracast_station_id             — DROP COLUMN
runtime_target_type enum: 'azuracast'     — REMOVE
```

**Avvecklingsordning:**
1. Dölj AzuraCast i UI (ta bort från navigation, dölja i listor) — inga data raderas
2. Ta bort applikationskod (lib, server, routes)
3. Köra DB-migrationer när inga aktiva kopplingar finns

Se `BROADCAST-PLATFORM-PLAN.md` Fas 1 för detaljer.

---

## 4. Media via playback_url från R2

### Det gamla sättet (AzuraCast-baserat)

```
Radio Core → synkade filer → AzuraCast lokal disk → Liquidsoap läser lokalt
```

Filer kopierades till AzuraCast. Liquidsoap fick lokala sökvägar i M3U-filer.

### Det nya sättet (R2-baserat)

```
Fablesh → R2/CDN → playback_url → Radio Core lagrar URL → Liquidsoap streamer HTTP
```

1. Fablesh publicerar en asset till R2, exponerar `playback_url`
2. Radio Core lagrar URL:en i `broadcast_assets.playback_url`
3. Vid config-generering: M3U-filer fylls med HTTP-URLer istället för lokala sökvägar
4. Runner skriver M3U-filerna till Liquidsoap-volymen
5. Liquidsoap läser M3U och hämtar audio via HTTP direkt från CDN

```
# Gammalt M3U (lokalt)
/data/stations/radio-uppsala/media/artist-song.mp3

# Nytt M3U (HTTP)
https://cdn.fablesh.com/media/abc123/artist-song.mp3
```

**Liquidsoap HTTP-stöd:** Liquidsoap 2.x hanterar HTTP-URIer i playlist-filer transparent via `request.create`. Inga ändringar i Liquidsoap-konfigurationen krävs — bara URL-formatet i M3U-filerna ändras.

**Konsekvens:** Ingen `media`-volym i Docker Compose. Inga filer synkas. Runner är stateless på riktigt.

---

## 5. Broadcast Asset-modellen

Radio Core introducerar `broadcast_assets` — en unified tabell för alla typer av sändningsbart ljud. Tabellen ersätter och utökar `media_files`.

### Asset-typer

| Typ | Beskrivning | Källa |
|-----|-------------|-------|
| `music` | Musikspår | Fablesh |
| `podcast` | Podcast-avsnitt | Fablesh / RSS |
| `jingle` | Stationsidentitet, korta ID:n | Fablesh / lokal |
| `toth` | Top-of-the-hour — tidssignal | Fablesh / lokal |
| `advertisement` | Reklamspot | Fablesh / extern |
| `sweeper` | Musikalisk övergång | Fablesh / lokal |
| `liner` | Presentatörs-liner, rösttagg | Fablesh / lokal |
| `voicetrack` | Förinspelat presentatörsinnehåll | Fablesh / lokal |
| `news` | Nyhetsaudio | News Hub / Fablesh |
| `program_segment` | Del av ett program/show | Fablesh / lokal |
| `fx` | Ljudeffekter | Fablesh / lokal |

### Nyckelprinciper

- Varje asset har exakt en `playback_url` som Liquidsoap använder
- `r2_key` lagras som referens men Radio Core utför inga R2-operationer på den
- `fablesh_id` kopplar tillbaka till Fablesh-systemet
- `station_id` är nullable — globala assets (jinglar, sweepers) kan delas mellan stationer
- Tabellen innehåller aldrig credentials eller råa R2-tokens

---

## 6. Multi-station-arkitektur

### Principen

Radio Core är designat för obegränsat antal stationer från samma kontrolplan. Varje station har:

- Egen `station_id` (UUID)
- Egna spellistor, rotationsregler, scheman, assets
- Egna Icecast/Liquidsoap-konfigurationer
- Egna streaming-outputs
- Egna runtime hosts (runtime VPS)
- Eget stack token (station-scopat)

### Token-hierarki

```
Global token (station_id = NULL)
  → Kan läsa/skriva alla stationer
  → Används av globala admin-operationer

Station-scopat token (station_id = X)
  → Kan bara läsa/skriva station X
  → Används av runnern per station
  → Cross-tenant guard i alla API-endpoints
```

### En Docker Compose-stack per station

```
VPS Stockholm        VPS Göteborg         Demo-server
station: radio-      station: crystal-    station: demo-radio
         uppsala              radio
port:    8000         port:    8000         port:    8000
token:   [unik]       token:   [unik]       token:   [unik]
```

Varje VPS är helt isolerad. Runner-processen har bara credentials för sin station. Icecast exponerar sin port externt. Inget delat state.

### Exempel: tre stationer, tre runtime hosts

```
Radio Core Web (kontrolplanet)
├─ Radio Uppsala      → agent: vps-stockholm-1  (token: rck_abc...)
├─ Crystal Radio      → agent: vps-goteborg-1   (token: rck_def...)
└─ Demo Radio         → agent: vps-demo-1       (token: rck_ghi...)
```

---

## 7. Runner: stateless agent

Runner är den enda komponenten som kommunicerar med Radio Core. Den är avsiktligt stateless.

### Runners ansvar

```
HÄMTAR (från Radio Core):
  GET /api/public/station-config    → icecast_xml, liquidsoap_liq, playlists[]

SKRIVER (till lokal Docker-volym):
  /etc/icecast/icecast.xml          → icecast-config volym
  /etc/liquidsoap/radio.liq         → liquidsoap-config volym
  /etc/liquidsoap/playlists/*.m3u   → spellistor med HTTP-URLer

RELOADAR:
  Icecast: SIGHUP till PID-filen
  Liquidsoap: telnet 'restart'

RAPPORTERAR (till Radio Core):
  POST /api/public/agent/heartbeat  → status, capabilities, metrics
  POST /api/public/now-playing      → Liquidsoaps metadata-callbacks
  POST /api/public/health           → hälsa per service (icecast, liquidsoap, stereo_tool)
  POST /api/public/listener-stats   → lyssnardata från Icecast status-JSON
```

### Runners icke-ansvar

Runner hanterar **inte**:
- Mediasynk (inga filer kopieras)
- Direkta Supabase-anrop
- R2-credentials
- Liquidsoap-logik (den skriver bara `.liq`-filen)

---

## 8. API-kontrakt: Runner ↔ Radio Core

Dessa endpoints är det fullständiga kontraktet mellan runnern och Radio Core. De är stabila och versionerade.

### GET /api/public/station-config

```
Auth:   x-stack-token: <station-scoped token>
Query:  ?station=<slug>

Response 200:
{
  station: { id, name, slug },
  icecast_xml: string,
  liquidsoap_liq: string,
  playlists: [
    { file: "pl_0_rotation.m3u", content: "https://cdn.../track.mp3\n..." }
  ]
}

Response 409: Station inte fullt konfigurerad ännu
Response 401: Ogiltigt token
Response 403: Token tillhör annan station
```

### POST /api/public/agent/heartbeat *(ska implementeras, Fas 3)*

```
Auth:   x-stack-token: <station-scoped token>

Body:
{
  "agent_id": "uuid",
  "version": "1.0.0",
  "hostname": "vps-stockholm-1.example.com",
  "station_slug": "radio-uppsala",
  "capabilities": {
    "liquidsoap": true,
    "icecast": true,
    "stereo_tool": false
  },
  "metrics": {
    "cpu_percent": 12.4,
    "mem_mb": 480,
    "uptime_seconds": 86400
  }
}

Response 200:
{
  "ok": true,
  "reload_requested": false,   // true = hämta config omedelbart
  "config_version": "sha256..."
}
```

### POST /api/public/now-playing

```
Auth:   x-stack-token

Body:
{
  "station_slug": "radio-uppsala",
  "title": "Song Title",
  "artist": "Artist Name",
  "album": "Album Name",
  "mount": "/radio-uppsala.mp3",
  "listeners": 42
}
```

### POST /api/public/health

```
Auth:   x-stack-token

Body:
{
  "service": "liquidsoap",    // runner|liquidsoap|icecast|stereo_tool
  "status": "healthy",        // healthy|degraded|down|unknown
  "message": "telnet ok",
  "details": {}
}
```

### POST /api/public/listener-stats

```
Auth:   x-stack-token

Body:
{
  "station_slug": "radio-uppsala",
  "mount": "/radio-uppsala.mp3",
  "listeners": 42,
  "peak": 67
}
```

---

## 9. Kodseparation: gränser och konventioner

Radio Core Web är en TanStack Start-app (en deploy, en process) men koden organiseras i tre distinkta lager. Separation är **logisk**, inte fysisk.

### Lager 1: Frontend (`src/routes/*.tsx`, `src/components/`, `src/lib/ui/`)

**Ansvar:**
- React-komponenter och sidor
- Auth-state (Supabase session, roller)
- Station-context (aktiv station i UI)
- Player-context (mini-player, public stream)
- Direkt Supabase-access via RLS (anon-klient)

**Tillåter:**
- `import { supabase } from "@/integrations/supabase/client"`
- `useServerFn(fn)` för privilegierade operationer
- `import { useQuery } from "@tanstack/react-query"`

**Tillåter inte:**
- `import { supabaseAdmin }` — bara server-side
- `import "@/api/server/*"` — server-only moduler
- Direkt access till R2/S3-credentials

### Lager 2: Backend (`src/api/`, `src/routes/api.*.ts`)

**Ansvar:**
- `createServerFn`-handlers med privilegierad access
- HTTP-routes för runner, externa klienter och cron
- Config-generering (Icecast XML, Liquidsoap .liq, M3U)
- Token-autentisering och verifiering
- Integrationer (R2, Fablesh API, podcast-synk)

**Tillåter:**
- `import { supabaseAdmin }` — RLS-bypass för betrodda operationer
- Hemliga environment-variabler (S3_*, CRON_SECRET)
- Server-only moduler (`*.server.ts`)

**Tillåter inte:**
- React-importer
- `import.meta.env.VITE_*` — det är klientvariabler

### Lager 3: Runtime (`runner/`, `deploy/`)

**Ansvar:**
- Python-daemon (runner.py)
- Docker Compose-stack (Icecast, Liquidsoap, Stereo Tool, Runner)
- Deployment-dokumentation

**Tillåter:**
- HTTP-anrop till Radio Core:s publika API
- Lokal Docker-volym-access (icecast-config, liquidsoap-config)

**Tillåter inte:**
- Direkta Supabase-anrop
- R2-credentials
- Kunskap om interna Radio Core-strukturer

### Fil-namnkonventioner

| Mönster | Lager | Typ |
|---------|-------|-----|
| `src/routes/*.tsx` | Frontend | React-sida (admin/public UI) |
| `src/routes/api.public.*.ts` | Backend | HTTP-endpoint (extern access) |
| `src/routes/api.cron.*.ts` | Backend | HTTP-endpoint (cron-triggers) |
| `src/lib/*.ts(x)` | Frontend | UI-hooks, context, validation |
| `src/api/functions/*.ts` | Backend | `createServerFn`-moduler |
| `src/api/server/*.server.ts` | Backend | Server-only moduler |
| `runner/runner.py` | Runtime | Broadcast-agent |
| `deploy/docker-compose.yml` | Runtime | VPS-orkestrering |

---

## 10. Vad som redan finns (implementation-status)

### ✅ Fullt implementerat och produktionsklart

| Komponent | Fil(er) |
|-----------|---------|
| Station-config API | `api.public.station-config.ts` |
| Now-playing API | `api.public.now-playing.ts` |
| Health reporting API | `api.public.health.ts` |
| Listener stats API | `api.public.listener-stats.ts` |
| Icecast XML-generering | `src/api/server/streaming.server.ts` |
| Liquidsoap .liq-generering | `src/api/server/streaming.server.ts` |
| Streaming outputs (adapters) | `src/api/server/streaming-adapters.server.ts` |
| Runtime adapter-system | `src/api/server/runtime-adapters/` |
| Stack tokens (auth-mekanismen) | `stack_tokens`-tabell + alla API:er |
| Runner (Python-daemon) | `runner/runner.py` |
| Docker Compose (icecast, liquidsoap, runner) | `deploy/docker-compose.yml` |
| Agent instances (tabell + UI) | `src/routes/agents.tsx` |
| Live inputs (harbor) | `live_inputs`-tabell + `live_inputs.tsx` |
| Podcast Hub (synk + subscriptions) | `podcast-hub.tsx` + `podcasts.functions.ts` |
| Nyhetsmodul (CRUD + broadcast history) | `news.tsx` + `news.functions.ts` |
| Schema-block (veckoschema) | `scheduler.tsx`, `schedule_blocks` |
| Rotationsregler | `rotation.tsx`, `rotation_rules` |
| Spellistor + tilldelningar | `playlists.tsx`, `playlist_assignments` |
| R2-lagring (upload, lista, radera) | `r2-storage.functions.ts` |
| Multi-station-scoping | `station-context.tsx` + cross-tenant guards |

### ⚠️ Delvis implementerat — behöver stärkas

| Komponent | Status | Fas |
|-----------|--------|-----|
| Heartbeat-endpoint | Dokumenterat i `docs/agents.md`, ej implementerat | Fas 3 |
| Stack Token UI | Skapas idag direkt i DB, inget admin-UI | Fas 2 |
| `broadcast_assets`-tabell | Saknas, `media_files` är placeholder | Fas 4 |
| R2/HTTP-URLer i M3U | Idag lokala sökvägar, behöver HTTP | Fas 5 |
| Reload-trigger från UI | `agent_instances.reload_requested_at` saknas | Fas 3 |
| Stereo Tool i Docker Compose | Kommenterad, ej service | Fas 6 |

### ❌ Saknas helt

| Komponent | Fas |
|-----------|-----|
| `POST /api/public/agent/heartbeat` endpoint | Fas 3 |
| Stack Token admin-UI (skapa, återkalla) | Fas 2 |
| `broadcast_assets`-tabell med `asset_type` och `playback_url` | Fas 4 |
| Liquidsoap M3U med HTTPS-URLer | Fas 5 |
| News Hub sync-mekanism | Fas 5+ |
| Voicetrack-scheduling | Fas 5+ |
| Stereo Tool som Docker-service | Fas 6 |

---

## 11. Roadmap

### Fas 1 — Logisk kodseparation och dokumentation
*Mål: Tydliga lager i koden utan funktionella förändringar.*

**Uppgifter:**

1.1 Skapa mappstruktur `src/api/` med undermappar:
```
src/api/
├─ functions/     (tomma platshållar-filer med rätt namn)
└─ server/        (symlink eller kopia av nuvarande src/server/)
```

1.2 Flytta `src/lib/*.functions.ts` → `src/api/functions/*.ts`
- Uppdatera alla importer i `src/routes/*.tsx`
- Verifiera att `useServerFn` och `createServerFn` fortfarande fungerar
- Inget beteende ändras, bara filsökvägar

1.3 Dölj AzuraCast i UI — **ej ta bort kod**:
- Ta bort `/azuracast`-länken från `sidebar.tsx`
- Ta bort `azuracast`-alternativet ur runtime-targets-formulärets typ-lista
- Dölj AzuraCast-kolumner i media- och playlists-sidor via CSS/conditional render
- Kod och data förblir orörd

1.4 Döp om route-filer till ny namnkonvention:
- `api.public.cron.*.ts` → `api.cron.*.ts` (intern cron, inte publik)
- Dokumentera distinktionen i `docs/architecture/api-contract.md`

1.5 Skapa `src/api/README.md` med API-kontrakt och auth-regler

**Leverans:** Ren mappstruktur. Alla lager identifierbara. AzuraCast osynlig i UI.  
**Tidskostnad:** ~3 dagar. Noll funktionella risker.

---

### Fas 2 — Stack Token UI och token lifecycle
*Mål: Admins kan hantera tokens via UI, inte via direkt DB-access.*

**Uppgifter:**

2.1 Server-fn: `createStackToken({ name, purpose, station_id })`
- Generera 32 bytes random: `crypto.randomBytes(32).toString('base64url')`
- Prefix: `rck_` + random = `rck_abc123...`
- SHA-256 hasha, spara hash i `stack_tokens`
- Returnera raw token **en gång** i svaret, spara aldrig

2.2 Server-fn: `revokeStackToken({ id })`
- Sätt `is_active = false`
- Uppdatera kopplad `agent_instances.status = 'offline'`

2.3 Ny route: `src/routes/tokens.tsx`
- Lista alla tokens (namn, purpose, station, is_active, last_used_at)
- Knapp: "Skapa token" → modal med namn/purpose/station → visar raw token en gång
- Knapp: "Återkalla" → confirm → revokeStackToken

2.4 Lägg till token-sida i sidebaren under Inställningar/Admin

**Leverans:** Admins kan skapa station-scoped tokens för runners.  
**Tidskostnad:** ~2 dagar.

---

### Fas 3 — Heartbeat och runtime-status i UI
*Mål: Radio Core Web vet om runnern är online och kan triggera reload.*

**Uppgifter:**

3.1 Ny endpoint: `src/routes/api.public.agent.heartbeat.ts`
```typescript
POST /api/public/agent/heartbeat
x-stack-token: <secret>
```
- Verifiera token via stack_tokens
- Uppdatera agent_instances: last_seen_at, status='online', version, hostname, capabilities
- Kontrollera reload_requested_at — returnera reload_requested: true om satt
- Rensa reload_requested_at efter svar

3.2 DB-migration (icke-destruktiv):
```sql
ALTER TABLE agent_instances ADD COLUMN IF NOT EXISTS reload_requested_at timestamptz;
```

3.3 Server-fn: `requestAgentReload({ agent_id })`
- Sätt `agent_instances.reload_requested_at = now()`
- Nästa heartbeat plockar upp det

3.4 Uppdatera `src/routes/agents.tsx`:
- Visa online/offline-status med last_seen_at (< 60s = online, annars offline)
- Knapp: "Trigger reload" → requestAgentReload
- Visa capabilities-badges per agent

3.5 Uppdatera `runner.py`:
- Lägg till heartbeat-loop (var 30:e sekund)
- Om heartbeat-svaret har `reload_requested: true` → fetch_config omedelbart
- `AGENT_ID` som env-variabel (UUID, matchar agent_instances.id)

**Leverans:** Radio Core Web vet om runnern lever. Reload kan triggras från UI.  
**Tidskostnad:** ~3 dagar.

---

### Fas 4 — Broadcast Asset-modellen
*Mål: Unified tabell för alla sändningsbara assets med playback_url.*

**Uppgifter:**

4.1 DB-migration: skapa `broadcast_assets`
```sql
CREATE TABLE broadcast_assets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id       uuid REFERENCES stations(id) ON DELETE SET NULL,
  asset_type       text NOT NULL, -- se listan i avsnitt 5
  title            text NOT NULL,
  artist_or_source text,
  r2_key           text,
  playback_url     text NOT NULL,
  mime_type        text,
  codec            text,
  duration_seconds numeric,
  loudness_lufs    numeric,
  waveform         jsonb,
  is_active        boolean NOT NULL DEFAULT true,
  status           text NOT NULL DEFAULT 'ready',
  fablesh_id       text,
  external_id      text,
  source_type      text,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

4.2 Lägg till `broadcast_asset_id` i `playlist_assignments` (nullable, bredvid befintlig `media_file_id`)
- Backfill befintliga rader: mappa `media_files` → `broadcast_assets` för existerande data

4.3 Ny route: `src/routes/assets.tsx`
- Lista assets med filtrering på asset_type, station, status
- Stöd för manuell registrering (klistra in playback_url)
- Visa waveform om tillgänglig

4.4 Server-fn för Fablesh-import:
- `importFableshAsset({ fablesh_id, station_id })` — hämtar metadata från Fablesh API, skapar broadcast_assets-rad
- Backfill: importera befintliga `podcast_episodes.audio_url` som broadcast_assets av typ `podcast`

4.5 Uppdatera TypeScript-typer:
- Ny `ASSET_TYPES` konstant i `src/lib/media-kind.ts` (ersätter `MEDIA_KINDS`)
- Kör `supabase gen types` efter migration

**Leverans:** Alla sändningsbara assets representeras uniformt med playback_url.  
**Tidskostnad:** ~4 dagar.

---

### Fas 5 — Liquidsoap med HTTPS-URLer från R2
*Mål: Liquidsoap hämtar media direkt från R2/CDN. Ingen lokal mediasynk.*

**Uppgifter:**

5.1 Uppdatera `generateStationConfig()` i `streaming.functions.ts`:
- Ersätt `media_files`-query med `broadcast_assets`-query för playlist-tilldelningar
- Generera `playback_url` istället för lokal filsökväg

5.2 Uppdatera `renderM3u()` i `streaming.server.ts`:
```typescript
// Gammalt:
`/data/stations/${station.slug}/media/${asset.file_path}`

// Nytt:
asset.playback_url  // https://cdn.fablesh.com/media/abc.mp3
```

5.3 Uppdatera `/api/public/station-config`-routen:
- Hämta playlist-tilldelningar via `broadcast_assets` istället för `media_files`
- M3U-innehållet innehåller HTTP-URLer

5.4 Verifiera Liquidsoap HTTP-stöd:
- Testa `playlist("/etc/liquidsoap/playlists/pl_0_rotation.m3u")` med HTTP-URLer i Liquidsoap 2.2.5
- Verifiera att `request.create` hanterar HTTP utan timeout-problem

5.5 Ta bort `media`-volymen från Docker Compose:
- Liquidsoap behöver inte längre `/data/stations`-volymen
- Runner behöver inte längre `MEDIA_DIR`-variabeln

5.6 Uppdatera `runner.py`:
- Ta bort all logik för lokal mediasynk
- Ta bort `MEDIA_DIR`-variabeln

**Leverans:** Komplett medieflöde via R2/CDN. VPS behöver ingen lokal lagring för media.  
**Tidskostnad:** ~3 dagar.

---

### Fas 6 — Runtime VPS: komplett Docker Compose
*Mål: En production-ready Docker-stack utan AzuraCast.*

**Uppgifter:**

6.1 Uppdatera `deploy/docker-compose.yml`:
- Ta bort `media`-volymen (ej längre nödvändig efter Fas 5)
- Lägg till `stereo_tool`-service:
  ```yaml
  stereo_tool:
    image: ${STEREO_TOOL_IMAGE}
    restart: unless-stopped
    volumes:
      - stereo-tool-config:/etc/stereo-tool
    networks: [radiocore]
  ```
- Uppdatera `liquidsoap` att bero på `stereo_tool` om aktiverat

6.2 Stereo Tool-integration i Liquidsoap-config:
- Lägg till `stereo_tool_enabled boolean` och `stereo_tool_preset text` i `liquidsoap_configs`
- `renderLiquidsoapLiq()` genererar pipe-baserad output om `stereo_tool_enabled = true`

6.3 Uppdatera `runner.py` för Stereo Tool-hälsa:
```python
if STEREO_TOOL_ENABLED:
    st_alive = check_process("stereo_tool")
    report_health("stereo_tool", "healthy" if st_alive else "down")
```

6.4 Uppdatera `.env.example` i deploy/:
- Ta bort `MEDIA_DIR` och AzuraCast-relaterade variabler
- Lägg till `STEREO_TOOL_IMAGE`, `STEREO_TOOL_ENABLED`, `AGENT_ID`

6.5 Uppdatera `deploy/README.md`:
- Dokumentera att media-volymen inte längre behövs
- Dokumentera Stereo Tool-konfiguration

**Leverans:** Produktionsklar Docker-stack. Inga AzuraCast-komponenter. Stereo Tool ingår.  
**Tidskostnad:** ~3 dagar.

---

## 12. Beroendegraf

```
Fas 1 (kodstruktur)
  └─► Fas 2 (token UI)         [oberoende av Fas 1, men bör göras efteråt]
        └─► Fas 3 (heartbeat)  [kräver att tokens kan skapas]
              └─► Fas 4 (assets) ─┐
                    └─► Fas 5 (R2/HTTP)
                          └─► Fas 6 (Docker)
```

Fas 1 och 2 kan köras parallellt. Fas 3 kräver Fas 2 (runner behöver ett token). Fas 4-6 är en sekvens.

**Kritisk väg:** 1 → 2 → 3 → 4 → 5 → 6

**Minimal viable broadcast:** Fas 1 + 2 + 3 + 5 (hoppa Fas 4 om `media_files` fortfarande används med gamla URLs)

---

## 13. Miljövariabler: komplett förteckning

### Radio Core Web (Lovable Cloud Secrets)

| Variabel | Typ | Lager | Syfte |
|----------|-----|-------|-------|
| `VITE_SUPABASE_URL` | Publik | Frontend | Supabase URL (browser) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publik | Frontend | Anon key (browser) |
| `SUPABASE_URL` | Server | Backend | Supabase URL (server) |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Backend | Anon key (auth-middleware) |
| `SUPABASE_SERVICE_ROLE_KEY` | Hemlig | Backend | Admin-klient (RLS-bypass) |
| `S3_ENDPOINT` | Hemlig | Backend | R2 endpoint |
| `S3_ACCESS_KEY_ID` | Hemlig | Backend | R2 credentials |
| `S3_SECRET_ACCESS_KEY` | Hemlig | Backend | R2 credentials |
| `S3_BUCKET_MEDIA` | Server | Backend | R2 bucket (media) |
| `S3_BUCKET_ARTWORK` | Server | Backend | R2 bucket (artwork) |
| `S3_BUCKET_PUBLIC` | Server | Backend | R2 bucket (public) |
| `MEDIA_PUBLIC_URL` | Server | Backend | CDN-domän (media) |
| `ARTWORK_PUBLIC_URL` | Server | Backend | CDN-domän (artwork) |
| `PUBLIC_CDN_URL` | Server | Backend | CDN-domän (public) |
| `CRON_SECRET` | Hemlig | Backend | Cron-endpoint auth |
| `PUBLIC_APP_URL` | Server | Backend | Radio Core:s publika URL (Liquidsoap callbacks) |

### Runtime VPS (Docker Compose `.env`)

| Variabel | Syfte |
|----------|-------|
| `RADIO_CORE_API_URL` | Radio Core Web URL |
| `RADIO_CORE_STATION_SLUG` | Stationens slug |
| `RADIO_CORE_STACK_TOKEN` | Station-scopat runner-token |
| `AGENT_ID` | UUID som matchar `agent_instances.id` |
| `POLL_INTERVAL_SECONDS` | Config-pollfrekvens (default: 30) |
| `HEALTH_INTERVAL_SECONDS` | Hälsorapport-frekvens (default: 60) |
| `ICECAST_PORT` | Extern port för Icecast (default: 8000) |
| `STEREO_TOOL_ENABLED` | Aktivera Stereo Tool (default: false) |
| `STEREO_TOOL_IMAGE` | Docker-image för Stereo Tool |

---

## 14. Relaterade dokument

| Dokument | Innehåll |
|----------|---------|
| `BROADCAST-PLATFORM-PLAN.md` | Detaljerad plan för AzuraCast-avveckling och broadcast_assets |
| `ARCHITECTURE-SEPARATION-PLAN.md` | Analys av Alternativ A vs B för kodseparation |
| `ARCHITECTURE.md` | Platform-översikt (Radio Core / Listen / Radio Uppsala) |
| `STORAGE-DESIGN.md` | Lagringsstrategi (nu delvis ersatt av detta dokument) |
| `docs/agents.md` | Agent ↔ web app-kontrakt |
| `docs/adapters.md` | Hur man lägger till runtime/storage-adapters |
| `runner/README.md` | Runner deployment-guide |
| `deploy/README.md` | Docker Compose deployment-guide |
