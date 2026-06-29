# Radio Core — Infrastrukturarkitektur

**Datum:** 2026-06-29  
**Status:** Strategidokument — inga kodändringar ingår  
**Ersätter:** Lovable Cloud + Supabase  
**Plattformar:** GitHub · Vercel · Cloudflare · Linux VPS

---

## Sammanfattning

Radio Core är ett broadcast control plane. Systemet har fyra naturliga ansvarsdomäner som mappar direkt mot de valda infrastrukturplattformarna:

```
GitHub      — Kod, CI/CD, tester, migrationer
Vercel      — Web app, API, server functions
Cloudflare  — DNS, R2, CDN, signerade URL:er
Linux VPS   — Runtime (runner, Liquidsoap, Icecast, Stereo Tool)
```

Dessa fyra plattformar pratar med varandra via vältestade HTTP-interfaces. Ingen av dem är beroende av Lovable eller Supabase.

---

## Del 1 — Nuläge och vad som förändras

### Vad som är stabilt idag (rörs inte)

- **R2-integrationen** — `src/server/r2-storage.server.ts` är ren AWS SDK S3, fungerar utan ändringar
- **Runner-protokollet** — HTTP med `x-stack-token`, helt oberoende av Supabase Auth
- **Stack token auth** — eget hash-system, inga Supabase-beroenden
- **Alla publika API-endpoints** — standard HTTP, inga plattformsspecifika konstruktioner
- **Docker Compose runtime** — `deploy/` är redan självständigt
- **TanStack Start + React 19 + Tailwind** — rena öppna ramverk
- **Cron-endpoints** — `/api/public/cron/*` har redan `CRON_SECRET`-mönster klart

### Vad som ersätts

| Idag | Ersätts med |
|---|---|
| Lovable Cloud (hosting) | Vercel |
| Supabase Auth (JWT, OAuth) | Custom JWT + direkt OAuth |
| Supabase PostgREST | Drizzle ORM + direktanslutning |
| Supabase-hosted PostgreSQL | Neon (eller self-hosted) |
| Manuell deploy från Lovable | GitHub Actions → Vercel |
| Supabase `pg_cron` | Vercel Cron Jobs |
| Supabase Edge Functions (AzuraCast) | Borttagna (legacy) |

---

## Del 2 — Målarkitektur

### Översiktsbild

```
┌──────────────────────────────────────────────────────────────────────┐
│                          GITHUB                                      │
│  repo · branches · PRs · Issues · Actions (CI/CD) · Secrets         │
└─────────────────────┬────────────────────────────────────────────────┘
                      │ git push / merge
                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          VERCEL                                      │
│  TanStack Start (SSR)                                                │
│  ├── React UI (admin, scheduler, rotation, agents, tokens)           │
│  ├── Server Functions (createServerFn → /_server/*)                  │
│  ├── Public API (/api/public/station-config, /heartbeat, /health)    │
│  ├── Cron Jobs (/api/public/cron/sync-worker, /cron/podcast-sync)    │
│  └── Auth (/auth, /auth/callback, JWT-utfärdning)                   │
│                                                                      │
│  Env vars: DATABASE_URL, JWT_SECRET, OAUTH_*, R2_*, CRON_SECRET      │
└──────────┬───────────────────────────────┬───────────────────────────┘
           │ SQL (TLS)                     │ S3 API (HTTPS)
           ▼                               ▼
┌─────────────────────┐        ┌───────────────────────────────────────┐
│   PostgreSQL        │        │           CLOUDFLARE                  │
│   (Neon / VPS)      │        │                                       │
│                     │        │  R2 Buckets                           │
│  radio_core DB      │        │  ├── radio-core-media (audio)         │
│  50 tabeller        │        │  ├── radio-core-artwork (bilder)      │
│  Drizzle ORM        │        │  └── radio-core-public (övrigt)       │
│  Migrationer via    │        │                                       │
│  GitHub Actions     │        │  CDN / Public URLs                    │
│                     │        │  ├── media.radiouppsala.se            │
│                     │        │  ├── img.radiouppsala.se              │
│                     │        │  └── cdn.radiouppsala.se             │
└─────────────────────┘        │                                       │
                               │  DNS                                  │
                               │  ├── app.radiouppsala.se → Vercel    │
                               │  └── *.radiouppsala.se               │
                               │                                       │
                               │  Workers (framtid)                    │
                               │  └── Signerade URL:er för R2          │
                               └───────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          LINUX VPS                                   │
│  Docker Compose                                                      │
│  ├── runner (Python) — polls Vercel API med x-stack-token           │
│  ├── Liquidsoap — audio engine (fetchar media från R2 CDN)          │
│  ├── Icecast-KH — public streaming (port 8000)                      │
│  └── Stereo Tool — audio processing (optional)                      │
│                                                                      │
│  Rapporterar till Vercel:                                            │
│  ├── POST /api/public/health                                         │
│  ├── POST /api/public/now-playing (via Liquidsoap callback)          │
│  ├── POST /api/public/listener-stats                                 │
│  └── POST /api/public/agent/heartbeat                               │
└──────────────────────────────────────────────────────────────────────┘
```

### Dataflöde: media

```
Fablesh / Catalogus → R2 (radio-core-media) → CDN URL i DB → Liquidsoap via HTTP
```

Vercel lagrar aldrig mediafiler. R2 är den enda media-originen. Liquidsoap hämtar ljud direkt från R2/CDN via HTTP URI:er i Liquidsoap-skriptet. Radio Core äger bara `playback_url`.

### Dataflöde: autentisering (målläge)

```
Browser → Vercel /auth (Google PKCE) → OAuth callback → JWT utfärdas
JWT lagras i httpOnly cookie
Server function → Jose JWT verify → userId → Drizzle query
```

### Dataflöde: runner

```
runner.py → GET /api/public/station-config (x-stack-token) → Vercel → Drizzle → PostgreSQL
runner.py → POST /api/public/agent/heartbeat (x-stack-token) → Vercel → Drizzle → PostgreSQL
Liquidsoap callback → POST /api/public/now-playing (x-stack-token) → Vercel → Drizzle → PostgreSQL
```

---

## Del 3 — GitHub-ansvarsdomän

### Repository-struktur

```
radio-core/
├── src/                    # TanStack Start (Vercel)
│   ├── routes/             # Sidor + API-endpoints
│   ├── lib/                # Server functions (createServerFn)
│   ├── server/             # Server-only modules
│   ├── db/                 # Drizzle schema, klient, repositories
│   │   ├── schema/         # Drizzle tabeller (en fil per domän)
│   │   ├── migrations/     # SQL-migrationer (genererade av drizzle-kit)
│   │   └── index.ts        # Drizzle-klient (DATABASE_URL)
│   └── integrations/       # Auth, externa tjänster
├── runner/                 # Python runtime agent
├── deploy/                 # Docker Compose för VPS
├── docs/                   # Arkitektur, migration
├── .github/workflows/      # CI/CD
├── vercel.json             # Vercel-konfiguration
└── package.json
```

### GitHub Actions (CI/CD)

**`ci.yml` — körs på varje PR:**
```yaml
- npm run typecheck
- npm run lint
- npm run test
- npm run build (verifierar att build går igenom)
```

**`migrate.yml` — körs vid merge till main:**
```yaml
- drizzle-kit migrate (mot produktionsdatabas via DATABASE_URL secret)
- Vercel deploy trigger (via Vercel Git-integration, automatisk)
```

**`deploy-preview.yml` — körs vid PR:**
```yaml
- Vercel preview deploy (automatisk via Vercel Git-integration)
- Kommentar på PR med preview-URL
```

**`runner-ci.yml` — körs vid ändringar i runner/:**
```yaml
- Python lint (ruff)
- Python type check (pyright)
- Runner unit tests (pytest)
```

### GitHub Secrets (krävs)

| Secret | Beskrivning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon eller self-hosted) |
| `JWT_SECRET` | 32+ bytes för JWT-signering |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Apple OAuth |
| `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Cloudflare R2 |
| `S3_BUCKET_MEDIA` / `S3_BUCKET_ARTWORK` / `S3_BUCKET_PUBLIC` | R2 bucket-namn |
| `CRON_SECRET` | Skyddar cron-endpoints |
| `VERCEL_TOKEN` | Vercel API (om Actions triggar deploy manuellt) |

---

## Del 4 — Vercel-ansvarsdomän

### Vad Vercel hanterar

**Web app (SSR med TanStack Start):**
- React UI — stationer, schema, rotation, streaming, agents, tokens, nyheter, poddar
- Server functions via `createServerFn` → kompileras till `/_server/*`

**API-endpoints (server route handlers):**

| Endpoint | Konsument | Auth |
|---|---|---|
| `GET /api/public/station-config` | Runner | `x-stack-token` |
| `POST /api/public/agent/heartbeat` | Runner | `x-stack-token` |
| `GET/POST /api/public/health` | Runner, UI | `x-stack-token` / JWT |
| `POST /api/public/now-playing` | Liquidsoap | `x-stack-token` |
| `GET /api/public/now-playing` | Extern (widgets) | Öppen |
| `POST /api/public/listener-stats` | Runner | `x-stack-token` |
| `GET/POST /api/public/radio/news/*` | Extern | Öppen / `x-stack-token` |
| `POST /api/public/cron/sync-worker` | Vercel Cron | `CRON_SECRET` |
| `POST /api/public/cron/podcast-sync` | Vercel Cron | `CRON_SECRET` |

**Vercel Cron Jobs (ersätter Supabase `pg_cron`):**
```json
// vercel.json
{
  "crons": [
    { "path": "/api/public/cron/sync-worker",  "schedule": "*/5 * * * *"  },
    { "path": "/api/public/cron/podcast-sync", "schedule": "*/15 * * * *" }
  ]
}
```
Cron-anropet skickar automatiskt en `Authorization: Bearer CRON_SECRET` header (Vercel-konvention). Endpointen validerar mot env-variabeln `CRON_SECRET`.

**Vercel Environment Variables:**
Alla secrets från GitHub Secrets speglas som Vercel env vars. Inget av dem exponeras till klienten (VITE_-prefix reserveras för de tre publika Supabase-URL:erna under övergångsfasen).

### `vercel.json` (utkast)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".output",
  "framework": null,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)",     "destination": "/index"  }
  ],
  "crons": [
    { "path": "/api/public/cron/sync-worker",  "schedule": "*/5 * * * *"  },
    { "path": "/api/public/cron/podcast-sync", "schedule": "*/15 * * * *" }
  ]
}
```

---

## Del 5 — Cloudflare-ansvarsdomän

### Vad Cloudflare hanterar idag (oförändrat)

R2-integrationen är redan 100% klar och oberoende av Supabase. `src/server/r2-storage.server.ts` använder standard AWS S3 SDK med Cloudflare R2-endpoint.

**Tre buckets:**
- `radio-core-media` — audio (mp3/wav/flac/m4a/ogg), max 500 MB per fil
- `radio-core-artwork` — bilder (jpg/png/webp/svg), max 25 MB per fil
- `radio-core-public` — blandat, CDN-servat

**Publika URL:er (CDN-servade via Cloudflare):**
- `https://media.radiouppsala.se` → `radio-core-media`
- `https://img.radiouppsala.se` → `radio-core-artwork`
- `https://cdn.radiouppsala.se` → `radio-core-public`

### DNS (målläge)

```
app.radiouppsala.se   → Vercel (CNAME)
media.radiouppsala.se → R2 CDN
img.radiouppsala.se   → R2 CDN
cdn.radiouppsala.se   → R2 CDN
stream.radiouppsala.se → Linux VPS (A-record, Icecast port 8000)
```

### Framtid: Cloudflare Workers för signerade URL:er

Koden har redan en stub i `r2-storage.server.ts`:
```typescript
export async function getSignedReadUrl(type, key, expiresInSeconds = 900) { ... }
```

Nästa steg är ett Cloudflare Worker som tar emot ett JWT från Vercel och returnerar en tidsbegränsad signerad URL till ett privat R2-objekt. Detta är relevant när Radio Core hanterar exklusivt/tidsbegränsat material.

### Cloudflare Queues (framtid)

Potentiell användning för:
- Asynkron metadata-import från Fablesh
- Webhook-events vid ny media
- Fördröjd notifiering vid config-ändringar

Inget behov idag. Designen stödjer det utan arkitekturändring.

---

## Del 6 — Linux VPS (Runtime)

### Vad servern hanterar

Servern är en ren broadcast-maskin. Den innehåller ingen affärslogik och ingen databas. All sanning lever i Radio Core-databasen via Vercel API:et.

**Komponenter (`deploy/docker-compose.yml`):**
- **Runner** (Python) — konfigurationsagent, pollar Vercel API var 30:e sekund
- **Liquidsoap** — audio engine, läser `.liq`-skript och `.m3u`-spellistor som Runner skriver
- **Icecast-KH** — streaming server, lyssnarfacing på port 8000
- **Stereo Tool** — valfri audioprocesor (kräver licens)

**Nätverksflöde (utgående från VPS):**
```
VPS → Vercel: station-config, heartbeat, health, now-playing, listener-stats
VPS → R2/CDN: Liquidsoap hämtar mediafiler via HTTP
VPS → Internet: Icecast sänder till lyssnare
```

**Krav på servern:**
- Ingen inkommande trafik från internet utöver Icecast-porten (8000)
- Vercel API-URL måste vara nåbar
- R2 CDN-URL:erna måste vara nåbara
- Docker Engine 24+

**Multi-station:** Varje station kör ett eget Docker Compose-stack (eller eget nätverk inom samma compose) med separata Runner-instanser och egna stack tokens.

---

## Del 7 — Backend-rekommendation

### Rekommenderad stack

**Databas:** PostgreSQL 17  
**ORM:** Drizzle ORM + drizzle-kit  
**Databasvärd:** Neon (Vercel-integrerad, serverless)  
**Auth:** Custom JWT med `jose` + Google OAuth (PKCE)  
**Sessions:** Rotating refresh tokens i `public.refresh_tokens`-tabell  

### Drizzle vs Prisma

| Kriterie | Drizzle | Prisma |
|---|---|---|
| SQL-transparens | ✅ Queries är SQL | ⚠️ Abstraherat |
| TypeScript-inferens | ✅ Excellent | ✅ Bra |
| Migrationsformat | SQL-filer | Proprietärt format |
| Bundle-storlek | ✅ Liten (~50 kB) | ⚠️ Stor (~700 kB) + runtime |
| Edge-kompatibilitet | ✅ Fungerar i Vercel Edge | ⚠️ Kräver Prisma Accelerate |
| Vendor lock-in | Ingen (ren PostgreSQL) | Låg (men Accelerate är ytterligare binding) |
| Passform för Radio Core | ✅ Komplex query-logik är läsbar | ⚠️ ORM-magi döljer rotation/schedule-queries |

**Drizzle vinner** för Radio Core specifikt för att systemet har komplex domänlogik (rotation-regler, schemaläggning, playlist-prioritering) där transparent SQL är en fördel, inte ett hinder.

### Auth.js vs custom JWT

| Kriterie | Auth.js (NextAuth) | Custom JWT (jose) |
|---|---|---|
| Kompatibilitet | Byggd för Next.js, TanStack-stöd är inofficiellt | ✅ Plattformsoberoende |
| Kontroll | Låg — "magic" session-hantering | ✅ Full kontroll |
| Komplexitet | Låg att komma igång | Medel att implementera |
| Portabilitet | Bundet till Node.js runtime | ✅ Web Crypto, fungerar i Vercel Edge |
| Runner token separation | ⚠️ Kräver anpassning | ✅ Naturlig separation (stack tokens förblir oförändrade) |

**Custom JWT med `jose` vinner.** Stack tokens är redan implementerade som custom hash-auth. Samma mönster utökas till user-JWT. Auth.js är i praktiken ett Next.js-bibliotek och passar dåligt med TanStack Start.

### Neon vs Vercel Postgres vs self-hosted

| | Neon | Vercel Postgres | Self-hosted |
|---|---|---|---|
| Vercel-integration | ✅ Officiell | ✅ Officiell | Manuell |
| Serverless scaling | ✅ Branch-per-PR | ✅ | N/A |
| Direktanslutning | ✅ (5432) | ✅ | ✅ |
| Kostnad (start) | Gratis → ~$20/mån | $0.10/GB | VPS-kostnad |
| Kontroll | Medel | Låg (Neon under huven) | Hög |
| Rekommendation | ✅ Vercel-deploy | — | Framtida runtime-DB |

**Neon rekommenderas** för Vercel-deploy. Neon stödjer branch-databaser per PR-preview, vilket ger isolerade testmiljöer utan kostnad. Vid behov av större kontroll kan databasen enkelt flyttas till self-hosted PostgreSQL utan kodändring (bara `DATABASE_URL` byts).

---

## Del 8 — Migrationsfaser

### Fas 1 — Frikoppla från Lovable (1 dag)

**Mål:** Bygga och deploya Radio Core utan ett enda Lovable-paket.

Detaljplan: se `docs/migration/lovable-exit-analysis.md`

Nyckelsteg:
1. Ersätt `vite.config.ts` med öppen konfiguration
2. Ta bort `@lovable.dev/*`-paket
3. Skapa `vercel.json` med Cron Jobs
4. Koppla GitHub-repo till Vercel
5. Skapa `.github/workflows/ci.yml`
6. Verifiera deploy från GitHub

**Risker:** Låg. Ingen databasändring.

---

### Fas 2 — Drizzle-schema och databasskikt (2–3 veckor)

**Mål:** Alla databasanrop går via Drizzle ORM mot en direktansluten PostgreSQL.

Nyckelsteg:
1. Lägg till Neon-databas via Vercel-integration (skapar `DATABASE_URL` automatiskt)
2. Skapa `src/db/schema/` med Drizzle-definitioner (baserade på befintliga migrations)
3. Kör `drizzle-kit generate` → generera SQL-migrationer
4. Skapa `src/db/index.ts` — Drizzle-klient
5. Lägg till `migrate.yml` GitHub Action (kör `drizzle-kit migrate` vid merge till main)
6. Migrera server functions domän för domän: stations → tokens → agents → streaming → schedules → resten
7. Behåll Supabase-queries parallellt tills varje domän är verifierad

**Ordning (minsta risk):**
```
stack_tokens (enkelt, redan vältestad)
→ agent_instances (redan vältestad)
→ stations + icecast/liquidsoap configs
→ playlists + rotation
→ users (sista — väntar på Fas 3)
```

**Risker:** Medel. Semantiska skillnader vid relationer. Mitigeras med domän-för-domän-strategi och parallella queries under övergången.

---

### Fas 3 — Ny autentisering (1–2 veckor)

**Mål:** Supabase Auth ersätts med egenägda JWT. Användare märker ingen skillnad.

Nyckelsteg:
1. Skapa `public.users`-tabell (id, email, display_name, avatar_url, created_at)
2. Skapa `public.refresh_tokens`-tabell
3. Implementera OAuth-callback: `/auth/callback` hanterar Google/Apple-svar och utfärdar JWT
4. Implementera `requireAuth`-middleware (ersätter `requireSupabaseAuth`) — validerar JWT med `jose`
5. Uppdatera `src/lib/auth.tsx` → hanterar eget JWT istället för Supabase-session
6. Migrera FK:er: `auth.users` → `public.users` (en migration, körs via GitHub Actions)
7. Migrera befintliga användare

**Parallellstrategi:** Ny auth implementeras som `/auth/v2/*` och testas i staging. Feature flag växlar over.

**Risker:** Hög. Auth är kritisk. Kräver noggrann testning. Plan B: Supabase Auth behålls ytterligare en sprint.

---

### Fas 4 — Datamigrering till Neon (½ dag)

**Mål:** Flytta all data från Supabase-hostad PostgreSQL till Neon.

Nyckelsteg:
1. Exportera schema + data från Supabase via `pg_dump`
2. Rensa Supabase-specifika konstruktioner (auth.*, storage.*, RLS-policies)
3. Importera till Neon via `psql`
4. Verifiera radantal per tabell
5. Byt `DATABASE_URL` i Vercel → ny deploy

**Underhållsfönster:** 30–60 minuter. Planeras till lågtrafiktid.

**Risker:** Låg om Fas 2 och 3 är klara. Risk för länge export/import av stora tabeller (play_history, listener_stats).

---

### Fas 5 — Ta bort Supabase (½ dag)

**Mål:** `@supabase/supabase-js` är borttaget.

Nyckelsteg:
1. Verifiera noll references till `supabase.from()` och `supabaseAdmin`
2. Ta bort `src/integrations/supabase/`
3. `npm uninstall @supabase/supabase-js`
4. Ta bort RLS-policies (ny migration)
5. Städa upp env vars och `supabase/config.toml`

**Risker:** Ingen om Fas 2–4 är klara.

---

### Fas 6 — Verifiering och stabilisering (1 dag)

**Mål:** Inget Lovable- eller Supabase-beroende kvarstår. Systemet är fullt verifierat.

Checklista:
- [ ] `npm run test` grön
- [ ] `npm run build` producerar artefakt utan `@lovable.dev` eller `@supabase`
- [ ] Google OAuth fungerar i produktion
- [ ] Runner + heartbeat fungerar mot Vercel API
- [ ] Liquidsoap hämtar media direkt från R2 CDN
- [ ] Cron Jobs triggar (kontrollera Vercel-loggar)
- [ ] GitHub Actions kör CI på PR och migrate vid merge
- [ ] Inga `supabase.*`-anrop kvarstår i källkoden

---

### Tidslinje

```
Vecka 1:       Fas 1 (Lovable-exit) + Fas 2 start (Drizzle schema)
Vecka 2–3:     Fas 2 (Drizzle migration per domän)
Vecka 3–4:     Fas 3 (ny auth, parallellt med slutet av Fas 2)
Vecka 4 (dag): Fas 4 (datamigrering, underhållsfönster)
Vecka 4 (dag): Fas 5 (ta bort Supabase SDK)
Vecka 4–5:     Fas 6 (verifiering + eventuella bugfixar)
─────────────────────────────────────────────────────
Total: 4–5 veckor
```

---

## Del 9 — Risker

| Risk | Sannolikhet | Konsekvens | Mitigering |
|---|---|---|---|
| `vite.config.ts`-ersättning bryter SSR | Låg | Kritisk (ingen build) | Testa lokalt innan merge |
| Drizzle-queries semantiskt avviker från PostgREST | Medel | Hög (buggar i queries) | Domän-för-domän, parallella queries |
| Auth-migrering låser ut användare | Medel | Hög | Parallell impl, feature flag, Plan B |
| Neon-databasmigrering tappar data | Låg | Kritisk | Verifiera med row counts, behåll Supabase i 2 veckor efter |
| TanStack Start + Vercel-kompatibilitet | Låg | Medel | Det finns befintlig `vercel.json` för TanStack Start |
| Cloudflare R2 CDN-konfiguration | Ingen | — | Redan i produktion, ingen förändring |
| Runner tappar kontakt under migrering | Låg | Låg | API-URL ändras inte, bara databasen bakom |

---

## Del 10 — Första säkra kodsteg

Det första steget som är helt ofarligt, reversibelt och ger omedelbart värde är:

**Skapa `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
```

Detta är ofarligt eftersom det inte ändrar ett enda tecken i applikationskoden och inte rör databasen. Det ger omedelbart:
- Automatisk verifiering att TypeScript kompilerar vid varje PR
- Automatisk testkörning (de 25 heartbeat-tester + token-tester som redan finns)
- En grund att bygga `migrate.yml` och `deploy-preview.yml` ovanpå

**Näst säkraste steg:** Koppla GitHub-repot till Vercel via Vercel Dashboard (zero-config) för att aktivera automatiska preview-deploys på PR och produktion-deploy vid merge till main — utan att ändra en rad kod.
