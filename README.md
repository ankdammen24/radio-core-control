# Radio Core

**Broadcast Operations Console** — a generic, white-label control plane for radio automation.

Radio Core is the source of truth for stations, media, runtime targets (AzuraCast, Icecast, Liquidsoap, Stereo Tool), object storage (Cloudflare R2 / S3 / local / Azure Blob), agent processes, sync jobs and operational events. The web app does not push audio itself — a paired Node.js Radio Core Agent runs on the broadcast host and executes real operational tasks against the local services.

## Architecture

```
                ┌─────────────────────────────┐
                │   Radio Core Web (this app) │
                │   TanStack Start + React    │
                └──────────────┬──────────────┘
                               │ server functions / REST
                               ▼
                ┌─────────────────────────────┐
                │   Lovable Cloud (Supabase)  │
                │   Postgres · Auth · RLS     │
                └──────┬──────────────┬───────┘
                       │              │
              REST / x-stack-token    │ object storage
                       │              ▼
                       ▼      ┌──────────────────┐
            ┌──────────────┐  │  Cloudflare R2   │
            │  Node.js     │  │  media · artwork │
            │  Radio Core  │  │  cdn · backups   │
            │  Agent       │  └──────────────────┘
            │  (VPS/Docker)│
            └──────┬───────┘
                   ▼
       AzuraCast · Icecast · Liquidsoap · Stereo Tool
```

## Tech stack

- **Frontend**: TanStack Start v1, React 19, Vite 7, Tailwind v4, shadcn/ui
- **Backend**: TanStack `createServerFn` + server routes (no Supabase Edge Functions for app logic)
- **Database / Auth**: Supabase (via Lovable Cloud) with strict RLS
- **Storage**: Cloudflare R2 (S3-compatible adapter), pluggable via `src/server/storage-adapters/`
- **Runtime adapters**: AzuraCast (full), Icecast (status-json probe), Liquidsoap & Stereo Tool (stubs — paired with the Agent for real control)

## Folder map

```
src/
├─ routes/                  # TanStack file-based routes (pages + /api/public/*)
├─ components/              # UI shell, sidebar, station switcher, shared cards
├─ lib/
│  ├─ *.functions.ts        # createServerFn modules (client-importable)
│  └─ ...
├─ server/                  # Server-only modules (.server.ts, adapter packs)
│  ├─ runtime-adapters/     # azuracast | icecast | liquidsoap | stereo-tool
│  ├─ storage-adapters/     # r2 | external-url | local stub | azure stub
│  └─ agent-client.server.ts
├─ integrations/supabase/   # Generated — never edit
└─ styles.css               # Design tokens (oklch)
docs/
├─ agents.md                # Radio Core Agent contract
├─ adapters.md              # How to add a runtime/storage adapter
└─ architecture.md
supabase/migrations/        # Versioned SQL migrations
```

## Quickstart

This project is built and previewed in Lovable. Backend (Postgres, Auth, secrets) is provisioned via **Lovable Cloud** — no local Supabase setup is required.

For local development against the cloned repo:

```bash
bun install
bun run dev
```

Required runtime secrets (managed via Lovable Cloud → Secrets, never committed):

| Variable | Purpose |
| --- | --- |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | Cloudflare R2 / S3 credentials |
| `S3_BUCKET_MEDIA`, `S3_BUCKET_ARTWORK`, `S3_BUCKET_PUBLIC` | R2 bucket names |
| `MEDIA_PUBLIC_URL`, `ARTWORK_PUBLIC_URL`, `PUBLIC_CDN_URL` | Public CDN domains |
| `AZURACAST_API_KEY` | AzuraCast bearer key (per-target via `api_key_secret_name`) |
| `LOVABLE_API_KEY` | Lovable AI Gateway (managed) |

The web app never reads R2 credentials — they are resolved server-side inside `createServerFn` handlers.

## Backend (Docker)

The minimal production backend (`nginx-proxy`, `radio-core-api`, `mongodb`) can be
started directly from the project root:

```bash
cp infra/.env.example infra/.env
docker compose up -d --build
docker compose ps
docker compose logs -f
docker compose down
```

The root `docker-compose.yml` includes [`infra/compose.yml`](./infra/compose.yml)
using `infra/.env` for variable interpolation, so paths and env vars resolve the
same way regardless of which directory you run from.

The underlying infra command remains available directly, e.g. for explicit
overlay files (`infra/compose.dev.yml`, `infra/compose.production.yml`):

```bash
docker compose -f infra/compose.yml --env-file infra/.env up -d --build
```

## Deployment

- **Web app**: published from Lovable to `*.lovable.app` (and optional custom domain). Frontend changes require clicking *Update* in the publish dialog; backend changes deploy immediately.
- **Agent**: see [`runner/`](./runner) and [`docs/agents.md`](./docs/agents.md) for the Docker-based Radio Core Agent that runs on the broadcast host.
- **GitHub**: connect the project via Lovable → GitHub. Two-way sync keeps the repo in lockstep with the editor.

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — platform overview (Radio Core / Listen / Radio Uppsala)
- [`STORAGE-DESIGN.md`](./STORAGE-DESIGN.md) — storage architecture and migration path
- [`docs/agents.md`](./docs/agents.md) — Radio Core Agent contract
- [`docs/adapters.md`](./docs/adapters.md) — adding runtime / storage adapters
- [`docs/architecture.md`](./docs/architecture.md) — pointers and conventions

## License

Proprietary — Radio Core. All rights reserved.
