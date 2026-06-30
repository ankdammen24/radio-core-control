# Vercel

Radio Core Frontend is backend-first. Supabase is an optional legacy
integration and is not required for build, startup, or read-only guest mode.

## Minimal production configuration

Set this single required variable for Production, Preview, and Development:

```env
VITE_API_URL=https://api.radiouppsala.se
```

The value must point to the Radio Core Nginx API gateway. Missing optional
variables must be left absent or empty.

## Optional local admin bootstrap

```env
VITE_ENABLE_LOCAL_AUTH=true
```

This explicitly enables a synthetic local administrator. It is intended for
initial bootstrap and development only. When false and no login provider is
active, the application runs in read-only guest mode.

## Optional Supabase legacy integration

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Supabase is enabled only when both values exist. The Vercel Supabase integration
names with the `NEXT_PUBLIC_RC_SUPABASE_` prefix are also detected. Server-only
service-role credentials must never have a `VITE_` or `NEXT_PUBLIC_` prefix.

## Deployment behavior

- Empty Radio Core responses render empty states.
- An unreachable API renders empty/degraded views instead of switching on a
  missing integration.
- Supabase migration automation skips successfully when `SUPABASE_DB_URL` is
  absent from GitHub Actions secrets.
- Vercel deployment protection and custom-domain DNS are configured separately
  from application environment variables.
