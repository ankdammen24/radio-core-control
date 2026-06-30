# Supabase fallback setup

The Vercel Supabase integration injects credentials, but it does not apply this
repository's database schema. Apply the versioned migrations before enabling
fallback traffic.

## Required Vercel variables

Radio Core supports both its standard names and the browser-safe names created
by the Vercel integration:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Use the Supabase publishable/anon key for both anon variables. The service-role
or secret key is server-only and must never use a `VITE_` prefix.

For a Vercel integration installed with the `RC_SUPABASE` prefix, these values
are detected directly; aliases are optional:

| Standard Radio Core variable | Vercel integration fallback             |
| ---------------------------- | --------------------------------------- |
| `VITE_SUPABASE_URL`          | `NEXT_PUBLIC_RC_SUPABASE_SUPABASE_URL`  |
| `VITE_SUPABASE_ANON_KEY`     | `RC_SUPABASE_SUPABASE_ANON_KEY`         |
| `SUPABASE_URL`               | `NEXT_PUBLIC_RC_SUPABASE_SUPABASE_URL`  |
| `SUPABASE_ANON_KEY`          | `RC_SUPABASE_SUPABASE_ANON_KEY`         |
| `SUPABASE_SERVICE_ROLE_KEY`  | `RC_SUPABASE_SUPABASE_SERVICE_ROLE_KEY` |

Never expose `RC_SUPABASE_SUPABASE_SECRET_KEY`, the service-role key, the JWT
secret, or a Postgres connection string through a `VITE_` or `NEXT_PUBLIC_`
variable.

## Automatic migrations

`.github/workflows/supabase-migrations.yml` applies migrations when migration
files are pushed to `main`. It can also be started manually from GitHub Actions.
Configure these GitHub Actions secrets in the repository (preferably in the
`production` environment):

```text
SUPABASE_DB_URL
```

Copy the current value of Vercel's
`RC_SUPABASE_POSTGRES_URL_NON_POOLING` into `SUPABASE_DB_URL`. Rotate the
database password before copying the URL if it has ever been exposed. The URL
is server-only and must never use a `VITE_` or `NEXT_PUBLIC_` prefix. The
workflow serializes runs, previews the migration plan, and only then applies it.

## Link and migrate

Get the new project reference from the Supabase dashboard URL, then run:

```bash
supabase login
supabase link --project-ref <new-project-ref>
supabase migration list
supabase db push --dry-run
supabase db push
```

Do not run `db pull` against a new, empty project: the repository already owns
the migration history. Only one operator should run `db push` at a time.

The final migration creates stable Radio Uppsala fallback records. Its station
UUID matches the MongoDB `RADIO_UPPSALA_STATION_ID` default so reads can switch
providers without changing station scope.

## First login

Create the first user through the existing application signup flow. The database
trigger assigns the first user the `admin` role; subsequent users start as
`viewer`.

After changing Vercel variables or applying migrations, trigger a new deployment
and verify `/migration-status`.
