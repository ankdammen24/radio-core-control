# Radio Core — Arkitekturseparation: Frontend / Backend / Runtime

> Teknisk analys och rekommendation för separering av serverroller.
> Skriven: 2026-06-29
> Status: ANALYS & PLAN — ingen kod är ändrad

---

## Del 1 — Nulägesanalys

### 1.1 Hur TanStack Start faktiskt fungerar

Radio Core är ett **TanStack Start**-projekt — ett fullstack-ramverk som kompilerar React-komponenter och server-handlers till en enda deploybody. Det är viktigt att förstå mekaniken innan man diskuterar separation.

```
Browser                     TanStack Start Server
  │                              │
  │  useServerFn(fn, args)       │
  │ ──────────── POST /_server/fn ──────────► fn() kör server-side
  │                              │            (läser DB, R2, secrets)
  │ ◄─────────── JSON response ──────────────│
  │                              │
  │  supabase.from("table")      │
  │ ──────────── REST ──────────► Supabase (RLS filtrerar)
  │ ◄─────────── rows ───────────│
```

Det finns alltså **tre** sätt data flödar i applikationen idag:

1. **`createServerFn` / `useServerFn`** — TanStack:s egna server-RPC. Kompileras till `/_server/...`-endpoints i samma process. Kräver auth (JWT) via `auth-attacher.ts`-middleware.

2. **`supabase.from()` direkt från komponenter** — klienten kallar Supabase REST API direkt med sin JWT. RLS styr åtkomst. Kräver `VITE_SUPABASE_URL` och `VITE_SUPABASE_PUBLISHABLE_KEY`.

3. **`server: { handlers: { GET/POST } }` i routes** — rena HTTP-endpoints som TanStack Start serverar. Används av runner, externa klienter och cron. Kräver **ingen** UI-kontext.

---

### 1.2 Inventering: vad är vad

#### Routes-katalogen (`src/routes/`): 61 filer

| Kategori | Antal | Exempel |
|----------|-------|---------|
| Admin UI-sidor | 42 st | `media.tsx`, `playlists.tsx`, `agents.tsx` |
| Public API-endpoints | 11 st | `api.public.station-config.ts`, `api.public.now-playing.ts` |
| Public views (listener-app) | 5 st | `schedule.tsx`, `listen.tsx`, `about.tsx` |
| Admin/auth | 3 st | `admin.login.tsx`, `admin.index.tsx`, `auth.tsx` |

Alla dessa lever i **samma mapp** och byggs till **samma deploybundle**.

#### `supabase.from()` i UI-komponenter: 145 anrop, 34 filer

Nästan alla admin-sidor anropar Supabase direkt från React-komponenter. Det är en medveten arkitektur: Supabase RLS är säkerhetslagret, och det fungerar bra. Konsekvensen är att **frontend behöver `VITE_SUPABASE_*`-variablerna**.

Exempel på direkta Supabase-anrop från UI:
```typescript
// src/routes/playlists.tsx
const { data } = await supabase.from("playlists").select("*").eq("station_id", id);

// src/routes/scheduler.tsx  
const { data } = await supabase.from("schedule_blocks").select("*").order("day_of_week");
```

#### `createServerFn` / `useServerFn`: 52 anrop, 14 filer

Används när operationen kräver:
- Hemliga credentials (R2, service role key)
- Komplex server-side logik (renderLiquidsoapLiq etc.)
- Privilegierade operationer som inte ska gå via RLS

```typescript
// src/lib/r2-storage.functions.ts — R2-credentials aldrig till klienten
// src/lib/streaming.functions.ts — config-generering
// src/lib/runtime-targets.functions.ts — health checks
```

#### Public API-routes: rena HTTP-handlers

```typescript
// api.public.station-config.ts — GET, autentiserat via x-stack-token
// api.public.now-playing.ts   — GET (public) + POST (x-stack-token)
// api.public.health.ts        — GET (auth) + POST (x-stack-token)
// api.public.listener-stats.ts — POST (x-stack-token)
// api.public.cron.*.ts        — POST (CRON_SECRET)
```

Dessa är **100% separerade** från UI redan. De importerar bara `supabaseAdmin` och affärslogik. Ingen React.

---

### 1.3 Supabase-klienter och deras roller

| Klient | Fil | Används av | Kräver |
|--------|-----|-----------|--------|
| `supabase` (anon) | `client.ts` | React-komponenter, browser | `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `supabase` (user JWT) | `auth-middleware.ts` | `createServerFn`-handlers | JWT från browser session |
| `supabaseAdmin` (service role) | `client.server.ts` | Public API routes, cron | `SUPABASE_SERVICE_ROLE_KEY` (hemlig) |

Klienten i `auth-middleware.ts` skapas per request med användarens JWT — det är inte den globala admin-klienten, utan en user-scoped klient med RLS aktiverat.

---

### 1.4 Auth-flöde i detalj

```
1. Användare loggar in via Lovable OAuth (Google/Apple/Microsoft)
   → supabase.auth.setSession(tokens)
   → Session sparas i localStorage

2. React-komponenter anropar supabase.from() direkt
   → JWT skickas automatiskt via supabase-klientens auth-config
   → RLS filtrerar baserat på user_roles

3. useServerFn() anrop
   → auth-attacher.ts middleware lägger till Authorization: Bearer <jwt>
   → POST /_server/<fn-hash>
   → auth-middleware.ts validerar JWT server-side
   → Handler kör med user-scoped supabase-klient

4. Public API routes (runner, cron)
   → x-stack-token header (sha256-hashat i stack_tokens)
   → INGEN Supabase JWT — token-autentisering istället
   → supabaseAdmin (service role) används för DB-access
```

---

### 1.5 Miljövariabler

| Variabel | Typ | Används av |
|----------|-----|-----------|
| `VITE_SUPABASE_URL` | Publik | Browser, SSR fallback |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publik (anon key) | Browser, SSR fallback |
| `SUPABASE_URL` | Server | Server functions, public API |
| `SUPABASE_PUBLISHABLE_KEY` | Server | auth-middleware (skapar user-klienter) |
| `SUPABASE_SERVICE_ROLE_KEY` | Hemlig (server) | supabaseAdmin — aldrig till klienten |
| `S3_*` | Hemlig (server) | R2-server functions |
| `CRON_SECRET` | Hemlig (server) | Cron-endpoints |
| `STACK_TOKEN` | Hemlig (server) | generateStationConfig-fn |
| `PUBLIC_APP_URL` | Server | Config-generering (callback-URL) |

Observera: `SUPABASE_SERVICE_ROLE_KEY` är **aldrig** i `.env`-filen — den hanteras av Lovable Cloud Secrets. Det är korrekt och måste bevaras i alla separationsscenarier.

---

### 1.6 Build-pipeline: Lovable-beroendet

```typescript
// vite.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig();
```

`@lovable.dev/vite-tanstack-config` är en **opak** config-paket från Lovable. Enligt kommentaren i filen inkluderar den:
- tanstackStart
- viteReact
- tailwindcss
- tsConfigPaths
- cloudflare (build-only)
- componentTagger (dev-only)
- VITE_* env injection
- @ path alias
- React/TanStack dedupe
- error logger plugins
- sandbox detection

Det betyder att du **inte kan** trivialt ersätta build-systemet utan att förstå vad detta paket gör. Separering bort från Lovable Cloud som deploy-target kräver att man ersätter detta med en manuell TanStack Start Vite-config.

---

## Del 2 — Alternativ A: Strukturerad monorepo (i samma process)

### Idén

Behåll TanStack Start som fullstack-app men organisera koden i tre tydliga lager inom samma projekt. Inga separata deploys — ett TanStack Start-deployment med tre distinkta kodlager:

```
src/
├─ frontend/          ← Allt UI (komponenter, routes, styles)
│  ├─ routes/         ← Bara .tsx-sidor (UI)
│  ├─ components/     ← React-komponenter
│  └─ lib/ui/         ← Hooks, context, auth-logic
│
├─ api/               ← Server-only logik
│  ├─ routes/         ← api.public.*.ts (HTTP-endpoints)
│  ├─ functions/      ← createServerFn-handlers (från src/lib/*.functions.ts)
│  └─ server/         ← server-only moduler (nuvarande src/server/)
│
└─ shared/            ← Delade typer och utilities
   ├─ types.ts
   └─ validation.ts
```

TanStack Start-routen-systemet håller ihop allt — frontend-routes och API-routes kompileras till samma bundle men har tydlig separation i koden.

### Vad som ändras

**Flytta filer — inga API-kontrakt ändras:**

| Från | Till |
|------|------|
| `src/routes/*.tsx` (UI) | `src/frontend/routes/*.tsx` |
| `src/routes/api.public.*.ts` | `src/api/routes/api.public.*.ts` |
| `src/lib/*.functions.ts` | `src/api/functions/*.functions.ts` |
| `src/server/*` | `src/api/server/*` |
| `src/components/` | `src/frontend/components/` |
| `src/lib/auth.tsx` m.fl. | `src/frontend/lib/` |

TanStack Router hittar routes via filsystemet — `routeTree.gen.ts` regenereras. Inga URL-ändringar.

### Fördelar

- **Noll risker.** Ingen ny teknologi, ingen ny deploy, inget nytt API-kontrakt.
- **Lovable Cloud-kompatibelt.** Vite-config och build-pipeline förblir oförändrade.
- **Snabbt.** En veckas refaktorering kontra månader för Alternativ B.
- **`createServerFn` behålls.** Mekanismen för säkra server-side-anrop fungerar utmärkt.
- **Samma secrets-hantering.** Lovable Cloud Secrets fungerar som idag.
- **Supabase direkt i komponenter** — det är en valid pattern för Supabase-appar. Inga onödiga proxylager.

### Nackdelar

- **En process** — skalning av frontend och backend sker tillsammans.
- **Delar fortfarande runtime** — om API:et är hårt belastat påverkas UI-renderingen.
- **Inte ett "riktigt" API** — runner och externa klienter kan kalla `/api/public/*` direkt, men server functions (`/_server/*`) är inte ett stabilt externt API.

### Konklusion för Alternativ A

Det är en **kodorganisations-förändring**, inte en arkitektur-förändring. Det är värdefullt men löser inte skalbarhetsfrågan på sikt.

---

## Del 3 — Alternativ B: Separata deploybara tjänster

### Idén

Bryt ut Radio Core i två (eller tre) separata applikationer med egna deploys:

```
radio-core-web/          ← Ren SPA (Vite + React, INGEN TanStack Start server)
radio-core-api/          ← REST API (Hono / Express / Fastify + Bun)
runner/                  ← Oförändrad (Python-daemon)
```

Frontenden anropar backend-API:et via vanliga `fetch()`. Inga `createServerFn`. Supabase-anrop kan antingen gå direkt (bevaras) eller via API:et.

### Vad det kräver

#### Konvertera alla createServerFn till REST-endpoints

Idag: `useServerFn(uploadObject)` → POST `/_server/<hash>`
Ny: `fetch('/api/r2/upload', { method: 'POST', body: ... })`

Det är 13 filer med server functions, 52 anrop i komponenter. Varje funktion måste:
1. Skrivas om som en Hono/Express-route
2. Bytas ut i alla komponenter mot vanliga fetch-anrop
3. Få auth-middleware implementerad på nytt (JWT-validering)

#### Byta build-system

Lovable-paketet `@lovable.dev/vite-tanstack-config` hanterar TanStack Start SSR. Med en ren SPA behövs det inte — men du måste:
1. Ersätta vite.config.ts med manuell Vite-config
2. Hantera Tailwind v4-config separat
3. Förlora Lovable Clouds eventuella edge-funktioner

#### Ny deploy-infrastruktur

- Frontend: statisk hosting (Cloudflare Pages, Netlify, etc.)
- Backend: en Bun/Node-process (Fly.io, Railway, VPS)
- Secrets: måste konfigureras i två separata environments
- CORS: måste konfigureras explicit

#### Auth-flödet måste byggas om

Idag: `auth-attacher.ts` lägger automatiskt till JWT på server-fn-anrop. I Alternativ B måste frontend manuellt bifoga JWT på varje API-anrop:
```typescript
const response = await fetch('/api/r2/upload', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

Det är hanterbart med en custom `apiFetch()`-wrapper, men är ett nytt abstraktion som måste underhållas.

### Fördelar

- **Oberoende skalning** — API:et kan skalas horisontellt utan att påverka frontend.
- **Stabilt externt API** — runner, Fablesh och andra klienter kan integrera mot ett väldefinierat REST-API.
- **Frihet från Lovable** — API:et kan deployas var som helst.
- **Framtidssäkert** — om Radio Core ska ha en mobil-app eller externa integrationer är ett separat API rätt.
- **Tydligare gränser** — frontend-devs och backend-devs kan arbeta oberoende.

### Nackdelar

- **Massiv migreringsinsats.** Konservativt estimat: 4-6 veckors arbete, hög risk för regressioner.
- **Tappar Lovable Cloud.** Utan `@lovable.dev/vite-tanstack-config` fungerar inte Lovable-deploys.
- **CORS-komplexitet.** Måste konfigureras och underhållas.
- **Duplicerad auth-logik.** JWT-validering behöver implementeras i det nya API:et.
- **Två environments att underhålla.** Secrets, env vars och CI/CD för två projekt.
- **`createServerFn` är en bra DX** — du förlorar co-location av client/server-kod.

---

## Del 4 — Rekommendation

### Rekommendera: **Alternativ A nu, med tydlig väg mot Alternativ B**

#### Varför inte Alternativ B nu

Det finns ett specifikt tekniskt hinder: **`@lovable.dev/vite-tanstack-config`**. Att bryta loss från det paketet utan att förstå exakt vad det gör riskerar att förstöra build-pipelinen. Det är ett blocking-problem som kräver mer undersökning.

Dessutom är migrationen stor (~52 server-fn-anrop rewritas), och värdet är svårt att motivera när Alternativ A kan ge 80% av tydligheten på 5% av arbetet.

#### Varför Alternativ A nu

Det riktiga problemet idag är inte deployment-separation — det är **kodorganisation**. Alla 61 routes i samma mapp, inga tydliga gränser, ingen konvention för vad som är "backend" vs "frontend". Det löser Alternativ A.

#### Alternativ A, men med en viktig distinktion

Gör **inte** en blind folder-flytt. Gör istället tre separata saker:

**Steg 1: Separera API-routes i TanStack Start**

`/api/public/*`-routes hanteras redan separat (`.ts`, inte `.tsx`). Standardisera detta:
- Alla public API-routes = `src/routes/api.public.*.ts` ✅ (redan så)
- Alla runner-specifika endpoints = `src/routes/api.runner.*.ts` (ny namnkonvention)
- Alla admin-server-fn = `src/api/` (ny mapp, inte under routes)

**Steg 2: Flytta server functions till `src/api/`**

```
src/api/
├─ auth.ts              ← requireSupabaseAuth middleware
├─ stack-token.ts       ← verifyStackToken helper
├─ functions/
│  ├─ streaming.ts      ← generateStationConfig etc.
│  ├─ r2-storage.ts     ← uploadObject etc.
│  ├─ runtime-targets.ts
│  ├─ agents.ts
│  └─ ...
└─ server/              ← nuvarande src/server/ (oförändrad)
```

`src/lib/` behålls för UI-nära logik (hooks, context, validation).

**Steg 3: Gör public API-lagret uttryckligt**

Samla alla public API-routes i en README/kontrakt-fil som dokumenterar:
- Vilka endpoints runnern kallar
- Vilka endpoints externa klienter kan kalla
- Auth-krav per endpoint

Detta ger en tydlig gräns utan att kräva en ny deploy.

---

### Väg mot Alternativ B — när det är rätt

Alternativ B är rätt när **något av följande är sant**:

1. Radio Core Web ska ha en **mobil-app** (React Native, Capacitor) — då behövs ett stabilt REST-API
2. **Fablesh** ska integrera mot Radio Cores API programmatiskt (inte bara dela R2)
3. API:et behöver **oberoende skalning** (t.ex. runner-heartbeaten belastar API:et hårt)
4. Ni vill **lämna Lovable Cloud** och self-hosta

**När det är dags, är rätt approach:**

Istället för att konvertera TanStack Start till SPA + separat API — lägg till ett **Hono API-lager** vid sidan av TanStack Start:

```
tanstack-start (nuvarande, oförändrad deploy)
  ├─ src/routes/api.public.*  ← runner/extern API (behålls)
  └─ src/routes/*.tsx          ← admin UI (behålls)

hono-api (ny, separat deploy vid behov)
  └─ src/api/                  ← stabil REST-API för externa klienter
```

TanStack Start-appen behålls som den är. Det nya Hono-API:et är en **tilläggsyta** för externa integrationer och mobil-appar — inte en ersättning. Server functions används fortfarande för admin-UI. Ingen migration krävs.

---

## Del 5 — Konkret implementationsplan för Alternativ A

### Fas A1: Namnkonvention och dokumentation (1 dag)

- Skapa `src/api/README.md` som dokumenterar API-kontraktet
- Byt namnkonvention: alla runner-endpoints namnges `api.runner.*` (nu `api.public.*`)
- Skapa `src/api/contracts/runner.ts` — TypeScript-typer för runner-APIets in/ut-format

### Fas A2: Flytta server functions (2-3 dagar)

Flytta `src/lib/*.functions.ts` → `src/api/functions/*.ts`:
```
src/lib/streaming.functions.ts      → src/api/functions/streaming.ts
src/lib/r2-storage.functions.ts     → src/api/functions/r2-storage.ts
src/lib/runtime-targets.functions.ts → src/api/functions/runtime-targets.ts
src/lib/agents.functions.ts         → src/api/functions/agents.ts
src/lib/sync.functions.ts           → src/api/functions/sync.ts
src/lib/streaming-outputs.functions.ts → src/api/functions/streaming-outputs.ts
src/lib/storage-targets.functions.ts → src/api/functions/storage-targets.ts
src/lib/backup.functions.ts         → src/api/functions/backup.ts
src/lib/news.functions.ts           → src/api/functions/news.ts
src/lib/podcasts.functions.ts       → src/api/functions/podcasts.ts
src/lib/public-station.functions.ts → src/api/functions/public-station.ts
src/lib/system-events.functions.ts  → src/api/functions/system-events.ts
```

Uppdatera importer i alla routes-filer. Inga API-kontrakt ändras.

### Fas A3: Flytta server-only moduler (1 dag)

`src/server/` → `src/api/server/` (oförändrat innehåll, bara ny sökväg)

### Fas A4: Dela upp lib/ (1 dag)

```
src/lib/ (behålls, UI-nära)          src/api/ (ny, server-nära)
├─ auth.tsx                           ├─ auth.ts (requireSupabaseAuth etc.)
├─ station-context.tsx                ├─ stack-token.ts
├─ player-context.tsx                 └─ functions/...
├─ theme.tsx
├─ use-public-station.ts
├─ utils.ts
├─ media-kind.ts
├─ validation.ts
└─ audit.ts
```

### Fas A5: Separera route-mappen (valfritt, sist)

Skapa konventionen att routes-filnamn talar om sin kategori:
- `_admin.*.tsx` — admin-UI (kräver inloggning)
- `_public.*.tsx` — publika views
- `api.public.*.ts` — offentlig HTTP-API
- `api.runner.*.ts` — runner-specifik HTTP-API (döps om)
- `api.cron.*.ts` — cron-endpoints (döps om)

---

## Del 6 — Slutgiltig mappstruktur (Alternativ A)

```
radio-core-control/
├─ src/
│  ├─ api/                      ← ALL server-side logik
│  │  ├─ README.md              ← API-kontrakt och dokumentation
│  │  ├─ auth.ts                ← requireSupabaseAuth middleware
│  │  ├─ stack-token.ts         ← verifyStackToken + helpers
│  │  ├─ functions/             ← createServerFn-moduler (från lib/)
│  │  │  ├─ streaming.ts
│  │  │  ├─ r2-storage.ts
│  │  │  ├─ agents.ts
│  │  │  └─ ...
│  │  └─ server/                ← server-only modules (rendering, adapters)
│  │     ├─ streaming.server.ts
│  │     ├─ runtime-adapters/
│  │     ├─ storage-adapters/
│  │     └─ agent-client.server.ts
│  │
│  ├─ routes/                   ← TanStack-routes (UI + HTTP-handlers)
│  │  ├─ __root.tsx
│  │  ├─ index.tsx
│  │  ├─ *.tsx                  ← Admin UI-sidor
│  │  ├─ api.public.*.ts        ← Publik HTTP-API (runner, externa klienter)
│  │  └─ api.cron.*.ts          ← Cron-endpoints
│  │
│  ├─ components/               ← React-komponenter (oförändrad)
│  ├─ lib/                      ← UI-nära logik och hooks
│  │  ├─ auth.tsx
│  │  ├─ station-context.tsx
│  │  ├─ player-context.tsx
│  │  ├─ validation.ts
│  │  ├─ utils.ts
│  │  └─ media-kind.ts
│  │
│  └─ integrations/
│     └─ supabase/              ← Supabase-klienter (oförändrad)
│
├─ runner/                      ← Python broadcast-agent
├─ deploy/                      ← Docker Compose för runtime-VPS
└─ docs/                        ← Arkitektur-dokumentation
```

---

## Del 7 — Sammanfattning

| Kriterium | Alternativ A | Alternativ B |
|-----------|-------------|-------------|
| Migreringstid | 1 vecka | 4-8 veckor |
| Lovable-kompatibilitet | ✅ Bevarad | ❌ Förlorad |
| Kodtydlighet | ✅ Stor förbättring | ✅ Maximal |
| Oberoende skalning | ❌ Nej | ✅ Ja |
| Stabilt externt API | ⚠️ Partiellt | ✅ Ja |
| Migreringsrisk | Låg | Hög |
| Rekommenderad nu | ✅ **JA** | ❌ Nej |
| Rekommenderad om 1 år | ⚠️ Utvärderas | ✅ Troligtvis |

**Gör Alternativ A nu.** Det löser det faktiska problemet (kodorganisation och tydlighet) utan att skapa nya problem (migreringsrisk, Lovable-separation, CORS, dubbla environments).

**Planera för Alternativ B** när ni behöver ett externt API för Fablesh-integration eller mobilapp — och implementera det då som ett tilläggslager (Hono) vid sidan av TanStack Start, inte som en ersättning.

---

*Plan klar. Ingen kod är ändrad.*
