# Radio Core

Radio Core is a white-label radio automation control plane designed for modern broadcast operations.

It manages radio stations, media libraries, playlists, scheduling, runtime configuration, streaming infrastructure and operational workflows — while using external runtime components such as AzuraCast, Liquidsoap, Icecast and Stereo Tool for actual broadcasting.

Radio Core is built to support:

- Single-station and multi-station deployments
- White-label operation
- Self-hosted environments
- Docker and future Kubernetes deployments
- Professional broadcast workflows
- Modern web-based operations
- API-driven integrations
- Runtime orchestration through sync jobs and runners

---

# Vision

Radio Core separates the **Control Plane** from the **Runtime Plane**.

## Control Plane

Radio Core handles:

- Stations
- Users and roles
- Media library
- Playlists
- Rotation rules
- Scheduling
- Shows and episodes
- Streaming configuration
- Mountpoints and relays
- Sync orchestration
- Audit logs
- Operational monitoring

## Runtime Plane

Runtime targets (AzuraCast, Icecast, Liquidsoap, Stereo Tool, custom Docker/Kubernetes services) are registered per station in **Integrations → Runtime Targets** and exercised through pluggable adapters in `src/server/runtime-adapters/`. Every manual "Test connection" writes a row to `runtime_health_checks` and mirrors a `runtime_health_check` job into `sync_jobs` for unified ops history. The Health page groups targets by station and surfaces reachability + now-playing.

Runtime services execute the actual broadcast chain:

- AzuraCast
- Liquidsoap
- Icecast / Icecast-KH
- Stereo Tool
- Audio processing pipelines

Radio Core treats runtime systems as deployable execution layers, while the database remains the source of truth.

---

# Core Principles

## Radio Core DB is the source of truth

All content, scheduling and configuration originates from the Radio Core database.

Runtime systems are synchronized from Radio Core.

---

## White-label first

No station-specific branding should be hardcoded.

All branding comes from station/account configuration:

- Name
- Logo
- Accent color
- Public URLs
- Slogans
- Public descriptions

---

## Runtime abstraction

Radio Core should not depend on a single runtime forever.

Current runtime target:

- AzuraCast

Future runtime adapters may include:

- standalone Liquidsoap
- custom Icecast setups
- Kubernetes-native broadcast runners
- cloud-native stream orchestration

---

## Server-driven architecture

All I/O should go through server functions or runtime runners.

The frontend should never communicate directly with runtime systems.

---

# Architecture

```text
Browser
  └── React 19 + TanStack Start + shadcn/ui + Tailwind v4

Control Plane
  ├── Server Functions
  ├── Public API routes
  ├── Sync orchestration
  ├── Auth + RLS
  └── Operational UI

Database
  └── Postgres (Supabase/Lovable)

Runtime Plane
  ├── AzuraCast
  ├── Liquidsoap
  ├── Icecast / Icecast-KH
  ├── Stereo Tool
  └── Audio processing

Runner
  └── radio-core-runner
