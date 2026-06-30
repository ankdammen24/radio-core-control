# Vercel

Radio Core runs entirely inside this Vercel deployment — TanStack Start
server routes under `/api/v1/*` handle stations, media, playlists, podcasts
and settings, backed by Postgres via Drizzle. There is no separate backend
server or Docker stack to deploy.

## Required production configuration

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Point this at the Postgres database provisioned by the Supabase-via-Vercel
integration (Settings → Integrations → Supabase), or any reachable Postgres
instance (e.g. Neon). After setting it, run `npm run db:push` locally with
the same `DATABASE_URL` to create/update the schema.

## Optional local admin bootstrap

```env
VITE_ENABLE_LOCAL_AUTH=true
```

This explicitly enables a synthetic local administrator. It is intended for
initial bootstrap and development only. When false and no login provider is
active, the application runs in read-only guest mode.

## Optional Supabase legacy integration (auth/client only)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

This is the Supabase JS client (auth, some still-unmigrated domains) —
separate from the `DATABASE_URL` Postgres connection above. Supabase is
enabled only when both values exist. The Vercel Supabase integration names
with the `NEXT_PUBLIC_RC_SUPABASE_` prefix are also detected. Server-only
service-role credentials must never have a `VITE_` or `NEXT_PUBLIC_` prefix.

## Optional external API gateway

```env
VITE_API_URL=
```

Only needed if you want the frontend to call an externally hosted API
instead of this deployment's own `/api/v1/*` routes. Leave unset for normal
same-origin operation.

## Deployment behavior

- Empty Postgres query results render empty states, not errors.
- An unreachable database renders empty/degraded views.
- Vercel deployment protection and custom-domain DNS are configured
  separately from application environment variables.
