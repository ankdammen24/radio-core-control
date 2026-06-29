# Lovable Exit Analysis

**Datum:** 2026-06-29  
**Status:** Klar för genomförande  
**Mål:** Göra Radio Core till ett helt fristående projekt — utvecklingsbart i VS Code/Claude Code, byggbart med npm, deploybart från GitHub till Vercel.

---

## Sammanfattning

Radio Core har tre Lovable-beroenden att ta bort:

| Beroende | Typ | Klassificering |
|---|---|---|
| `@lovable.dev/vite-tanstack-config` | devDependency | **REPLACE** — kritisk blocker |
| `@lovable.dev/cloud-auth-js` | dependency | **REPLACE** med Supabase OAuth direkt |
| `src/integrations/lovable/index.ts` | källkod | **REPLACE** |
| `src/routes/auth.tsx` (lovable-import) | källkod | **REPLACE** |
| `lovable.app`-fallback i `streaming.functions.ts` | källkod | **REPLACE** med `VERCEL_URL` |
| `.lovable/plan.md` | fil | **REMOVE** |
| `README.md` (Lovable-deploy-omnämnande) | text | **REMOVE** |
| `SUPABASE_SERVICE_ROLE_KEY` i Lovable Cloud Secrets | config | **REPLACE** → Vercel env var |
| `wrangler.jsonc` | deployment-config | **REMOVE** (ersätts av `vercel.json`) |
| `bunfig.toml` / `bun.lock` | pakethanterare | **KEEP** (fungerar med npm också; valfritt) |

---

## Detaljerad klassificering

### 1. `@lovable.dev/vite-tanstack-config` — REPLACE

**Var:** `package.json` devDependencies, `vite.config.ts`

**Vad det wrapplar** (enligt kommentar i `vite.config.ts`):
- `@tanstack/react-start` — TanStack Start plugin
- `@vitejs/plugin-react` — React-stöd
- `tailwindcss` (Vite-plugin)
- `vite-tsconfig-paths` — `@/*` path aliases
- `@cloudflare/vite-plugin` — Cloudflare Workers build (build-only)
- `lovable-tagger` (componentTagger) — **Lovable visuell editor-plugin, ingår ej i Vercel-flödet**
- `@lovable.dev/vite-plugin-dev-server-bridge` — Lovable dev-tunnel
- `@lovable.dev/vite-plugin-hmr-gate` — Lovable HMR-gate
- VITE_*-env-injektion, `@`-alias, React/TanStack-deduplicering, error logger

**Ersättning:** Ny `vite.config.ts` med direkt import av `@tanstack/react-start/vite`, `@vitejs/plugin-react`, `tailwindcss`, `vite-tsconfig-paths`. Lovable-specifika plugins (componentTagger, dev-server-bridge, hmr-gate) lämnas bort.

**Paketer att installera:**
```
npm install -D @tanstack/react-start vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vite-tsconfig-paths
```

**Paketer att ta bort:**
```
npm uninstall @lovable.dev/vite-tanstack-config
```

---

### 2. `@lovable.dev/cloud-auth-js` — REPLACE

**Var:** `package.json` dependencies, `src/integrations/lovable/index.ts`, `src/routes/auth.tsx`

**Vad det gör:** Wrapplar Lovable OAuth-proxy för Google och Apple sign-in. Routar auth-flödet via Lovables servrar istället för direkt mot Supabase.

**Ersättning:** `supabase.auth.signInWithOAuth({ provider: 'google' })` direkt i `auth.tsx`. Apple OAuth konfigureras i Supabase Dashboard under Authentication → Providers.

**Paketer att ta bort:**
```
npm uninstall @lovable.dev/cloud-auth-js
```

**Kräver:** Google OAuth-app konfigurerad i Supabase Dashboard (sannolikt redan konfigurerad — Lovable delegerade till Supabase under huven).

---

### 3. `src/integrations/lovable/index.ts` — REPLACE

Hela filen ersätts med direkt Supabase-anrop i `auth.tsx`. Filen kan tas bort.

---

### 4. `lovable.app`-fallback i `streaming.functions.ts` rad 56 — REPLACE

**Nuläge:**
```typescript
?? `https://project--${process.env.SUPABASE_PROJECT_ID ?? ""}.lovable.app`;
```

**Ersättning:**
```typescript
?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
```

`VERCEL_URL` sätts automatiskt av Vercel vid deploy. Ingen secrets-konfiguration behövs.

---

### 5. `SUPABASE_SERVICE_ROLE_KEY` — REPLACE (flytta till Vercel)

Nyckeln hanteras idag som en Lovable Cloud Secret. Den finns inte i `.env`. Vid Vercel-deploy måste den läggas till under Project Settings → Environment Variables:

```
SUPABASE_SERVICE_ROLE_KEY=<värdet från Supabase Dashboard → Settings → API>
```

**Övriga env vars** (redan i `.env`, behöver kopieras till Vercel):
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `S3_*` (R2-credentials)
- `ARTWORK_PUBLIC_URL`, `MEDIA_PUBLIC_URL`, `PUBLIC_CDN_URL`
- `PUBLIC_APP_URL` (production-URL, t.ex. `https://radio-core.example.com`)

---

### 6. `wrangler.jsonc` — REMOVE

Cloudflare Workers-konfiguration. Radio Core deployas till Vercel, inte Cloudflare Workers. Filen kan arkiveras eller tas bort. Om Cloudflare-alternativet ska behållas öppet, flytta till `wrangler.jsonc.bak` och notera i README.

---

### 7. `.lovable/plan.md` — REMOVE

Bara Fablesh-branding-anteckningar. Ingen runtime-relevans. Radera hela `.lovable/`-katalogen.

---

### 8. `bunfig.toml` / `bun.lock` — KEEP (valfritt)

Bara `saveTextLockfile = false`. Inget Lovable-specifikt. Bun fungerar parallellt med npm. Om teamet enbart vill använda npm kan `bunfig.toml` och `bun.lock` tas bort och ersättas med `package-lock.json`.

**Rekommendation:** Behåll tills vidare. Påverkar inte Vercel-build (Vercel detekterar `package-lock.json` automatiskt om den finns, annars används bun om `bun.lock` finns).

---

### 9. `scripts` i `package.json` — KEEP (inga ändringar)

```json
"dev": "vite dev",
"build": "vite build",
"test": "vitest run",
"typecheck": "tsc --noEmit",
"lint": "eslint ."
```

Alla dessa är standard. Fungerar direkt med npm/bun/pnpm efter att `vite.config.ts` är ersatt.

---

### 10. `vercel.json` — SKAPA (saknas idag)

TanStack Start SSR på Vercel kräver en `vercel.json`. Standardconfig för TanStack Start v1:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".output",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index" }
  ]
}
```

OBS: Exakt konfiguration beror på TanStack Start-versionen. Se [TanStack Start Vercel-guide](https://tanstack.com/start/latest/docs/framework/react/deployment/vercel) före implementation.

---

## Filer som är RENA (inga Lovable-beroenden)

Dessa behöver inte ändras:

- `src/routes/__root.tsx` — ren TanStack/React
- `src/integrations/supabase/client.ts` — standard Supabase (text om Lovable Cloud, valfritt att uppdatera)
- `src/integrations/supabase/client.server.ts` — dito
- `src/integrations/supabase/auth-middleware.ts` — ren TanStack middleware
- `src/server/env.server.ts` — ren Node
- `tsconfig.json` — ingen Lovable-konfiguration
- `eslint.config.js` — ingen Lovable-konfiguration
- `tailwind.config.ts` — standard Tailwind
- Alla routes utom `auth.tsx`
- Alla server functions
- `supabase/`-katalogen
- `runner/`-katalogen

---

## Stegvis migrationsplan

Varje steg är oberoende verifierbart och bryter inte funktionaliteten för det som fortfarande finns kvar.

---

### Steg 1 — Ersätt `vite.config.ts` (lokal dev blockerad av detta)

**Förutsättning:** Tillgång till det faktiska innehållet i `@lovable.dev/vite-tanstack-config`. Antingen via `node_modules` lokalt, eller via npm-registret om paketet är publikt.

**Åtgärder:**
1. Installera öppna alternativ:
   ```
   npm install -D @tanstack/react-start vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vite-tsconfig-paths
   ```
2. Ersätt `vite.config.ts`:
   ```typescript
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";
   import tailwindcss from "@tailwindcss/vite";
   import tsConfigPaths from "vite-tsconfig-paths";
   import { tanstackStart } from "@tanstack/react-start/vite";

   export default defineConfig({
     plugins: [
       tanstackStart(),
       react(),
       tailwindcss(),
       tsConfigPaths(),
     ],
   });
   ```
3. Ta bort `@lovable.dev/vite-tanstack-config`:
   ```
   npm uninstall @lovable.dev/vite-tanstack-config
   ```
4. Verifiera: `npm run dev` startar utan fel

**Risk:** Låg om TanStack Start-versionen är stabil. `tanstackStart()` hanterar SSR/server entry automatiskt.

---

### Steg 2 — Ersätt Lovable Auth med Supabase OAuth

**Åtgärder:**
1. Ta bort paketet:
   ```
   npm uninstall @lovable.dev/cloud-auth-js
   ```
2. Uppdatera `src/routes/auth.tsx` — ersätt `lovable.auth.signInWithOAuth("google", ...)` med:
   ```typescript
   import { supabase } from "@/integrations/supabase/client";

   await supabase.auth.signInWithOAuth({
     provider: "google",
     options: { redirectTo: `${window.location.origin}/auth/callback` },
   });
   ```
   Och för Apple:
   ```typescript
   await supabase.auth.signInWithOAuth({
     provider: "apple",
     options: { redirectTo: `${window.location.origin}/auth/callback` },
   });
   ```
3. Ta bort `src/integrations/lovable/index.ts`
4. Ta bort `src/integrations/lovable/` (katalog)
5. Kontrollera Supabase Dashboard → Authentication → Providers att Google och Apple är aktiverade med korrekta `redirect_url`.

**Risk:** Låg. Supabase OAuth fungerar identiskt — Lovable-wrappern var bara ett lager ovanpå samma Supabase-anrop.

---

### Steg 3 — Skapa `vercel.json` och konfigurera Vercel

**Åtgärder:**
1. Skapa `vercel.json` (se mall ovan — verifiera mot TanStack Start-dokumentation).
2. I Vercel Dashboard → Project Settings → Environment Variables, lägg till alla env vars från `.env` + `SUPABASE_SERVICE_ROLE_KEY`.
3. Koppla GitHub-repot till Vercel (om inte redan gjort).
4. Trigga första deploy från GitHub.
5. Verifiera att `PUBLIC_APP_URL` pekar på Vercel-URL:en (eller custom domain).

**Risk:** Medel. TanStack Start SSR på Vercel kräver rätt `outputDirectory` och rewrite-regler. Testa med en staging-deploy innan production.

---

### Steg 4 — Fixa `lovable.app`-fallback

**Åtgärder:**
1. I `src/lib/streaming.functions.ts` rad 56, ersätt fallback:
   ```typescript
   ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
   ```
2. Lägg till `PUBLIC_APP_URL` till `.env` och Vercel env vars med produktions-URL:n.

**Risk:** Ingen — detta är bara ett fallback som används om `PUBLIC_APP_URL` saknas.

---

### Steg 5 — Rensa Lovable-artefakter

**Åtgärder:**
1. `rm -rf .lovable/`
2. Uppdatera `README.md` — ta bort omnämnandet av Lovable-deploy.
3. Valfritt: uppdatera felmeddelanden i `client.ts`, `client.server.ts`, `auth-middleware.ts` — byt ut "Connect Supabase in Lovable Cloud" mot "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY environment variables".
4. Valfritt: ta bort eller arkivera `wrangler.jsonc`.

**Risk:** Ingen.

---

### Steg 6 — Verifiera och städa lock-filer

**Åtgärder:**
1. Kör `npm install` för att generera en ren `package-lock.json` utan Lovable-paketen.
2. Kör `npm run typecheck && npm run test && npm run build` — allt ska gå grönt.
3. Granska `package-lock.json`: kontrollera att inga `@lovable.dev/*` eller `lovable-tagger` kvarstår.

---

## Ordning och beroenden

```
Steg 1 (vite.config) ──► Steg 2 (auth) ──► Steg 3 (vercel) ──► Steg 4 (fallback) ──► Steg 5 (cleanup) ──► Steg 6 (verify)
```

Steg 1 måste komma först — utan fungerande lokal build kan inget testas.  
Steg 2 och 3 är oberoende av varandra och kan göras parallellt.  
Steg 4 och 5 är triviala cleanup-steg och kan göras när som helst.  
Steg 6 verifierar det slutliga tillståndet.

---

## Definition of Done

Migreringen är klar när:

- [ ] `npm run dev` startar utan `@lovable.dev`-paket installerade
- [ ] `npm run build` producerar ett artefakt utan Lovable-plugins
- [ ] `npm run test` är grön
- [ ] Google och Apple OAuth fungerar via Supabase direkt
- [ ] Vercel-deploy från GitHub bygger och deployas utan manuella steg
- [ ] Inga referenser till `@lovable.dev` finns kvar i `src/` eller `package.json`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` och övriga secrets finns som Vercel env vars
