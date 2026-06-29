# Radio Core — Arkitekturstrategi och migrationsplan

**Datum:** 2026-06-29  
**Scope:** Fullständig frikoppling från Lovable och Supabase  
**Mål:** Självständigt, portabelt SaaS-system under eget ägande

---

## Del 1 — Nulägesanalys

### 1.1 Systeminventering

Radio Core är ett fullstack-system byggt på TanStack Start v1 med React 19, Tailwind och shadcn/ui. Databasen är PostgreSQL hosted via Supabase. Autentisering och Row Level Security tillhandahålls av Supabase Auth-plattformen.

**Storleksordning:**
- 50 databastabeller
- 37 migrationsfiler
- 154 RLS-policies
- 35 route-filer med direkta databas-anrop
- 11 lib-filer (server functions) med databasanrop
- 14 publika API-endpoints (runner/agent-interface)
- 7 FK-constraints mot `auth.users` (Supabase-intern tabell)

### 1.2 Beroendekarta

#### Lovable-beroenden

| Beroende | Typ | Plats | Klassificering |
|---|---|---|---|
| `@lovable.dev/vite-tanstack-config` | devDep | `vite.config.ts` | **REPLACE** |
| `@lovable.dev/cloud-auth-js` | dep | `src/integrations/lovable/` | **REPLACE** |
| `lovable-tagger` | transitiv | via vite-tanstack-config | **REMOVE** |
| `vite-plugin-dev-server-bridge` | transitiv | via vite-tanstack-config | **REMOVE** |
| `vite-plugin-hmr-gate` | transitiv | via vite-tanstack-config | **REMOVE** |
| Lovable Cloud Secrets | platform | `SUPABASE_SERVICE_ROLE_KEY` | **REPLACE** → Vercel |
| `.lovable/plan.md` | fil | projektrot | **REMOVE** |
| `lovable.app`-fallback | källkod | `streaming.functions.ts:56` | **REPLACE** |

#### Supabase-beroenden

| Beroende | Typ | Plats | Klassificering |
|---|---|---|---|
| `@supabase/supabase-js` | dep | hela `src/` | **REPLACE** (Fas 2–5) |
| Supabase Auth JWT | platform | `auth-middleware.ts`, `auth.tsx` | **REPLACE** (Fas 3) |
| Supabase PostgREST API | platform | alla `supabase.from()` | **REPLACE** (Fas 5) |
| RLS-policies | DB | 154 policies i migrations | **REMOVE** (Fas 5) |
| `auth.users` tabell | DB | FK i profiles, user_roles m.fl. | **REFACTOR** (Fas 3–4) |
| `on_auth_user_created` trigger | DB | `auth.users` INSERT | **REFACTOR** (Fas 3) |
| Supabase Edge Functions | platform | azuracast-*.ts (3 anrop) | **REMOVE** (legacy AzuraCast) |
| `supabase/migrations/` | filer | 37 filer | **KEEP** (används som schema-källa) |

### 1.3 Hur autentisering fungerar idag

Tre separata auth-mekanismer är i bruk parallellt:

**1. Supabase-session (frontend-användare)**
- `supabase.auth.signInWithOAuth()` via Lovable-wrapper → Google/Apple OAuth
- Token lagras i `localStorage` av Supabase SDK
- `AuthProvider` i `src/lib/auth.tsx` lyssnar via `onAuthStateChange`
- Roller hämtas från `user_roles`-tabellen
- JWT skickas som `Authorization: Bearer <token>` till server functions

**2. Server function JWT-validering**
- `requireSupabaseAuth` middleware i `auth-middleware.ts`
- Skapar en Supabase-klient med user-JWT, kör `supabase.auth.getClaims(token)`
- JWT valideras av Supabase Auth-servern
- Ger tillbaka `{supabase, userId, claims}` i TanStack `context`

**3. Stack token (runner/agent)**
- `x-stack-token` header med `rck_`-prefixat token
- SHA-256 hash jämförs mot `stack_tokens.token_hash`
- Används i `/api/public/station-config` och `/api/public/agent/heartbeat`
- **Fullt oberoende av Supabase Auth** — bara en DB-lookup

### 1.4 Hur databasen används idag

**PostgREST-mönstret (supabase.from()):**
Alla queries mot applikationsdata går via `@supabase/supabase-js` SDK som under huven pratar med Supabase PostgREST-API:et. Ingen raw SQL används i applikationskoden.

**RLS-lagret:**
154 policies enforcar access på databas-nivå. Policies kontrollerar `auth.uid()` (Supabase-intern funktion) för att avgöra vilka rader en användare får se/ändra. I praktiken innebär detta att RLS gör en del av det arbete som annars görs i applikationslagret.

**supabaseAdmin (service role):**
Används för operationer som kräver bypass av RLS: heartbeat-endpoint, station-config, tokens. 14 serverfiler använder `supabaseAdmin`.

**Direkta client-side queries:**
35 route-filer (`.tsx`) anropar `supabase.from()` direkt från React-komponenter via TanStack Query. Det är inte raw client-side SQL utan går genom createServerFn-mönstret (server-side execution).

### 1.5 Hur TanStack Start används

TanStack Start v1 hanterar:
- File-based routing med dot-notation (`api.public.station-config.ts`)
- `createServerFn` — server functions som kompileras till `/_server/*` endpoints
- `createMiddleware` — middleware-chain för auth (`requireSupabaseAuth`)
- Server route handlers via `Route.server.handlers.{GET,POST}`
- SSR med React 19

**TanStack Start är inte Supabase-beroende.** Det är ett generellt fullstack-ramverk. Supabase-integrationen är tillagd ovanpå.

### 1.6 Vilka delar är hårt kopplade till Supabase

**Hårt kopplade (kräver refaktorering):**
- `auth-middleware.ts` — JWT-validering via Supabase Auth
- `client.ts` / `client.server.ts` — PostgREST-klienter
- `auth.tsx` — session, `onAuthStateChange`, Supabase-typer
- Alla `supabase.from()` / `supabaseAdmin.from()` i 46 filer
- `supabase/migrations/*.sql` — `auth.users` FK i 7 tabeller
- RLS-policies som använder `auth.uid()`

**Löst kopplade / beroende av konvention, inte plattform:**
- `src/server/*.server.ts` — ren serverlogik, inga Supabase-typer
- `src/routes/api.public.*` — HTTP-handlers med standard fetch API
- `src/server/streaming.server.ts` — config-rendering, ingen DB-coupling
- Stack tokens / heartbeat — custom auth, inte Supabase Auth
- `runner/` — Python daemon, kommunicerar via HTTP
- R2-integration — standard AWS S3 SDK
- Alla UI-komponenter (Radix, shadcn, Tailwind)

---

## Del 2 — Komplett klassificering

### Klassificeringstabell

| Komponent | Klassificering | Fas | Anmärkning |
|---|---|---|---|
| React 19 | **KEEP** | — | Behålls |
| TanStack Start v1 | **KEEP** | — | Behålls |
| TanStack Query v5 | **KEEP** | — | Behålls |
| Tailwind + shadcn/ui | **KEEP** | — | Behålls |
| Radix UI | **KEEP** | — | Behålls |
| AWS SDK (R2) | **KEEP** | — | Behålls |
| `src/server/streaming.server.ts` | **KEEP** | — | Ren logik |
| `src/server/env.server.ts` | **KEEP** | — | Ren Node |
| Alla publika API-endpoints | **KEEP** | — | HTTP-standard |
| Stack token auth | **KEEP** | — | Redan oberoende |
| Runner-protokollet | **KEEP** | — | HTTP-standard |
| `@lovable.dev/vite-tanstack-config` | **REPLACE** | Fas 1 | → `@tanstack/react-start/vite` |
| `@lovable.dev/cloud-auth-js` | **REPLACE** | Fas 1 | → direkt Supabase OAuth |
| `lovable.app`-fallback | **REPLACE** | Fas 1 | → `VERCEL_URL` |
| `wrangler.jsonc` | **REPLACE** | Fas 1 | → `vercel.json` |
| `src/integrations/supabase/client.ts` | **REPLACE** | Fas 2 | → Drizzle-klient |
| `src/integrations/supabase/client.server.ts` | **REPLACE** | Fas 2 | → Drizzle admin-klient |
| `src/integrations/supabase/auth-middleware.ts` | **REPLACE** | Fas 3 | → JWT-middleware (jose) |
| `src/integrations/lovable/index.ts` | **REMOVE** | Fas 1 | Hela filen |
| `.lovable/` katalog | **REMOVE** | Fas 1 | Hela katalogen |
| Supabase Edge Functions (AzuraCast) | **REMOVE** | Fas 1 | Legacy, redan markerad |
| RLS-policies | **REMOVE** | Fas 5 | Ersätts av app-layer auth |
| `@supabase/supabase-js` | **REMOVE** | Fas 5 | Sista steget |
| Alla `supabase.from()` queries | **REFACTOR** | Fas 2–5 | → Drizzle ORM |
| `auth.users` FK-references | **REFACTOR** | Fas 3 | → `public.users` |
| `handle_new_user()` trigger | **REFACTOR** | Fas 3 | → applikationslogik |
| `src/lib/auth.tsx` | **REFACTOR** | Fas 3 | → JWT session provider |
| `supabase/migrations/` | **REFACTOR** | Fas 2 | Adapteras till Drizzle schema |

---

## Del 3 — Migrationsplan

### Fas 1 — Frikoppla från Lovable

**Mål:** Radio Core ska kunna köras och byggas utan ett enda Lovable-paket.

**Påverkan:** Minimal. Inga databasändringar. Ingen förändrad användarupplevelse.

**Åtgärder:**
1. Ersätt `vite.config.ts` med öppen konfiguration
2. Ta bort `@lovable.dev/vite-tanstack-config` och `@lovable.dev/cloud-auth-js`
3. Ersätt `lovable.auth.signInWithOAuth()` med `supabase.auth.signInWithOAuth()` direkt i `auth.tsx`
4. Ta bort `src/integrations/lovable/`
5. Skapa `vercel.json` för TanStack Start SSR på Vercel
6. Flytta `SUPABASE_SERVICE_ROLE_KEY` till Vercel env vars
7. Ersätt `lovable.app`-fallback med `VERCEL_URL`
8. Radera `.lovable/` och AzuraCast Edge Function-anrop

**Risker:** Låg. Supabase-databasen rörs inte. Befintlig deploy via Lovable slutar fungera — Vercel-deploy tar över.

**Arbetsinsats:** 0,5–1 dag

---

### Fas 2 — Nytt datalager (Drizzle ORM)

**Mål:** Ersätta PostgREST-klienten (`supabase.from()`) med direkt PostgreSQL via Drizzle ORM.

**Påverkan:** Intern — inga API-ändringar. Queries byggs om en modul i taget.

**Åtgärder:**
1. Installera Drizzle ORM + `drizzle-kit` + `postgres` (node-postgres driver)
2. Definiera Drizzle-schema i `src/db/schema/` utifrån befintliga migrations
3. Skapa `src/db/index.ts` — Drizzle-klient mot samma PostgreSQL-databas
4. Skapa repository-moduler i `src/db/repositories/` som exponerar samma interface som nuvarande server functions
5. Migrera server functions en domän i taget (t.ex. stations → tokens → agents → streaming → schedules)
6. Kör nuvarande Supabase-queries parallellt tills varje domän är verifierad
7. RLS behålls under hela Fas 2 (Drizzle kopplar som service role, precis som `supabaseAdmin`)

**Databasvärdar:**
- **Under migrering:** Samma Supabase PostgreSQL-instans — direktanslutning via `DATABASE_URL` (Supabase erbjuder direktanslutning på port 5432)
- **Efter migrering:** Valfri PostgreSQL — Neon, Vercel Postgres, eller self-hosted

**Risker:** Medel. Störst risk är semantiska skillnader mellan PostgREST-queries och Drizzle — särskilt relationer och nested selects. Paketeras gradvis per domän.

**Arbetsinsats:** 2–3 veckor

---

### Fas 3 — Ny autentisering

**Mål:** Ersätta Supabase Auth med egenägd JWT-autentisering.

**Påverkan:** Alla inloggade användare loggas ut en gång (session-format ändras). OAuth-flödet ser identiskt ut för slutanvändaren.

**Åtgärder:**
1. Skapa `public.users`-tabell med samma fält som nuvarande `profiles` + password hash (nullable) och OAuth-identifiers
2. Implementera OAuth-callback-endpoint som hanterar Google/Apple-tokens direkt (utan Supabase som proxy)
3. Implementera JWT-utfärdning med `jose` — short-lived access tokens + rotating refresh tokens
4. Implementera ny `requireAuth` middleware i TanStack Start som validerar egna JWT
5. Migrera FK:er från `auth.users` → `public.users` (en databas-migration)
6. Flytta `handle_new_user()`-logiken till applikationslagret
7. Uppdatera `auth.tsx` React-provider att hantera egna JWT
8. Migrera befintliga användare: kopiera från `auth.users` + `profiles` till `public.users`

**Teknisk stack för auth:**
- OAuth: direkt mot Googles/Apples OAuth2-endpoints (PKCE-flöde)
- JWT: `jose` (Web Crypto API, körs i Vercel Edge)
- Refresh tokens: `public.refresh_tokens`-tabell
- Session: httpOnly cookie + Authorization header

**Risker:** Hög. Auth är kritisk infrastruktur. Kräver noggrann testning. Rekommenderat: Implementera parallellt med befintlig auth, switch via feature flag.

**Arbetsinsats:** 1–2 veckor

---

### Fas 4 — Migrera data

**Mål:** Flytta all data från Supabase-hostad PostgreSQL till fristående PostgreSQL.

**Påverkan:** Kräver ett underhållsfönster (30–60 minuter). Ingen kodändring.

**Åtgärder:**
1. Välj målvärd för PostgreSQL (rekommendation: Neon för Vercel, eller self-hosted)
2. Exportera schema: `pg_dump --schema-only` från Supabase
3. Rensa Supabase-specifika delar ur schema (auth.*, storage.*, RLS-policies)
4. Kör Drizzle `push` eller migrationsscript mot ny databas
5. Exportera data: `pg_dump --data-only` för alla publika tabeller
6. Importera till ny databas
7. Verifiera rowcounts och referensintegritet
8. Byt `DATABASE_URL` i Vercel — ny deploy

**Risker:** Låg — om Fas 2 och 3 är klara. Data-migreringen är mekanisk. Risk: downtime om export/import tar länge för stora tabeller (media_files, play_history, listener_stats).

**Arbetsinsats:** 0,5 dag (planering) + underhållsfönster

---

### Fas 5 — Ta bort Supabase SDK

**Mål:** Noll references till `@supabase/supabase-js`.

**Påverkan:** Intern. Inga synliga förändringar.

**Åtgärder:**
1. Verifiera att inga `supabase.from()` eller `supabaseAdmin.from()` kvarstår
2. Ta bort `src/integrations/supabase/` (hela katalogen)
3. Ta bort `@supabase/supabase-js` från `package.json`
4. Ta bort alla RLS-policies (de valideras inte längre)
5. Ta bort `bunfig.toml` och bun-specifika filer om npm används
6. Rensa upp `supabase/`-katalogen — behåll migrations som historik, ta bort `supabase/config.toml`

**Risker:** Ingen om Fas 2–4 är klara.

**Arbetsinsats:** 0,5 dag

---

### Fas 6 — Verifiering

**Mål:** Radio Core fungerar utan ett enda Lovable- eller Supabase-beroende.

**Åtgärder:**
1. Full E2E-genomgång av alla UI-flöden (stations, schedules, rotation, streaming, agents, tokens)
2. Runner-integration: `python runner.py` mot produktions-URL — verifiera station-config och heartbeat
3. Kontrollera att alla `npm run test` passerar
4. Kontrollera `npm run build` → ren artefakt utan Lovable-paket
5. Granska `package.json` och `package-lock.json` — inga `@lovable.dev/*` eller `@supabase/*` kvar
6. Verifiera OAuth-flöde med Google och Apple i produktionsmiljö
7. Load test: 100 simultana heartbeats mot `/api/public/agent/heartbeat`

**Arbetsinsats:** 1 dag

---

### Tidslinje (realistisk)

```
Fas 1 ─── dag 1         (0,5–1 dag)
Fas 2 ─── vecka 1–3     (2–3 veckor, iterativt per domän)
Fas 3 ─── vecka 3–4     (1–2 veckor, parallellt med slutet av Fas 2)
Fas 4 ─── dag 1 (underhåll, efter Fas 3)
Fas 5 ─── dag 1–2 (efter Fas 4)
Fas 6 ─── dag 1 (efter Fas 5)
─────────────────────────────────
Total: 4–6 veckor
```

---

## Del 4 — Backend-rekommendation: 5–10 år

### Utvärderade alternativ

#### Alternativ A: PostgreSQL + Drizzle ORM + custom JWT ✅ Rekommenderas

**Beskrivning:** Egenägd PostgreSQL (Neon eller self-hosted), Drizzle ORM för type-safe queries, JWT-auth med `jose`.

**Fördelar:**
- Drizzle är SQL-transparent — queries är läsbara, prestandaproblem är synliga, migrationer är plain SQL
- Noll vendor lock-in utöver PostgreSQL (som är en 30+ år gammal öppen standard)
- Custom JWT auth ger fullständig kontroll över token-livstid, session-management och MFA
- Fungerar identiskt på Vercel, Cloudflare Workers, egna Linux-servrar — samma kod
- Drizzle-schema genererar TypeScript-typer automatiskt (ersätter `supabase/types.ts`)
- Migrationsväg är rak: befintligt SQL-schema → Drizzle-schema

**Nackdelar:**
- Mer initial boilerplate jämfört med Supabase
- Ingen inbyggd OAuth-hantering — måste implementeras
- RLS måste ersättas med application-layer authorization

#### Alternativ B: PostgreSQL + Prisma

**Fördelar:** Välkänt, bra DX för team, schema-first.  
**Nackdelar:** Tyngre ORM-abstraktion, "magic" queries som döljer prestandaproblem, Prisma Accelerate är ytterligare leverantörskoppling, genererar JavaScript-runtime-kod. Sämre passform för ett system med komplex query-logik (rotation, scheduling).

#### Alternativ C: Behåll Supabase (drop SDK, direktanslutning)

**Fördelar:** Minst migrationsarbete — databasen rörs inte, bara klientbiblioteket byts.  
**Nackdelar:** Kvarstående leverantörskoppling till Supabase-hostad PostgreSQL, faktureringsberoende, ingen kontroll över databas-konfiguration.

#### Alternativ D: PocketBase

**Fördelar:** Allt-i-ett, enkelt att sätta upp.  
**Nackdelar:** SQLite-begränsningar vid skala, omoget ekosystem, hög leverantörskoppling till ett litet open source-projekt. Inte lämpligt för ett SaaS-system med 50 tabeller.

### Rekommendation

**PostgreSQL + Drizzle ORM + custom JWT** är den arkitektur som bäst uppfyller kraven för Radio Core de kommande 5–10 åren.

Skälet är inte att alternativen är dåliga, utan att Drizzle passar just det vi redan har: ett system med komplexa relationer, ett väldefinierat SQL-schema och behov av portabilitet mellan Vercel-edge och egna Linux-servrar. Drizzle är det enda TypeScript-ORM som kompilerar ner till raw SQL utan runtime-magi — queries är förutsägbara, prestandaproblem är synliga, och migrationshistoriken är läsbar text.

För databasvärd rekommenderas **Neon** (serverless PostgreSQL) för Vercel-deploy med branching-stöd för staging och preview environments. När runtime-servrar på egna Linux-servrar är aktuella (Radio Core Fas 6+) läggs en self-hosted PostgreSQL-instans till med replikering från Neon.

**Konkret stack:**

```
Databas:      PostgreSQL 17 (Neon för Vercel, self-hosted för runtime)
ORM:          Drizzle ORM + drizzle-kit (migrationer)
Auth:         custom JWT (jose) + Google/Apple OAuth (PKCE)
Sessions:     httpOnly cookies + refresh token rotation
Frontend:     React 19 + TanStack Start + Tailwind + shadcn/ui
Deployment:   Vercel (app) + GitHub Actions (CI) + Linux VPS (runtime)
Media:        Cloudflare R2 (S3-compatible, AWS SDK)
```

Ingen del av denna stack kräver ett betalt SaaS-abonnemang utöver Vercel (som redan är valt) och Neon (gratisnivå täcker tidiga faser, ~20 USD/mån vid skala). Hela stacken kan vid behov flytas till self-hosted utan kodändringar — Drizzle byter bara `DATABASE_URL`.
