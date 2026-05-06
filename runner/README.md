# Radio Core Runner

A small, stateless agent that turns a Radio Core control plane (`/api/public/*`)
into a running radio stack (Icecast-KH + Liquidsoap, with optional Stereo Tool).

## What it does

1. **Pulls** `GET /api/public/station-config?station=<slug>` every `POLL_INTERVAL_SECONDS`
2. **Writes** `icecast.xml`, `radio.liq` and playlist `.m3u` files to shared
   volumes — only when the upstream content has changed (sha256 fingerprint).
3. **Reloads** Icecast-KH (`SIGHUP` to its PID) and Liquidsoap (telnet `restart`).
4. **Reports** service health back to `POST /api/public/health` and listener
   counts (scraped from Icecast `/status-json.xsl`) to
   `POST /api/public/listener-stats`.
5. Liquidsoap itself reports now-playing directly to
   `POST /api/public/now-playing` — see the generated `radio.liq`.

The runner stores **nothing** locally except an in-memory fingerprint. The
Radio Core database is the single source of truth.

## Quick start

```bash
cp .env.example .env   # fill in API URL, station slug, stack token
docker compose up -d
docker compose logs -f runner
```

After a few seconds you should see:

- `service_health` rows in Radio Core with `service=runner status=ok`
- `icecast.xml` and `radio.liq` materialised in their volumes
- Icecast accepting source connections at `:8000`
- Now-playing updates flowing into the dashboard

## Configuration

All configuration is via environment variables — see `runner.py` docstring or
`docker-compose.yml`. The only mandatory ones:

| Variable                  | Example                          |
| ------------------------- | -------------------------------- |
| `RADIO_CORE_API_URL`      | `https://core.your-radio.com`    |
| `RADIO_CORE_STATION_SLUG` | `my-station`                     |
| `RADIO_CORE_STACK_TOKEN`  | issued from Radio Core admin UI  |

## Issuing a stack token

In Radio Core (admin role): create a row in `stack_tokens` with the desired
station and store the **sha256 hash** of a random secret. Hand the **raw**
secret to the runner via `RADIO_CORE_STACK_TOKEN`. The hash never leaves the
database; the raw token is only known to the runner.

## Stereo Tool

If you license Thimeo Stereo Tool, mount the binary + presets via
`STEREO_TOOL_DIR` (default `./stereo-tool`). The Liquidsoap config generator
will produce a `radio.liq` that loads the library when the station has it
enabled. **No proprietary binary ships in this repo.**

## Operational notes

- The runner is intentionally dumb — it never *decides* anything. All policy
  (rotation, ads, scheduler, Stereo Tool bypass, fallback) is computed by
  Radio Core when it generates the config.
- Liquidsoap config changes require a process restart. The runner attempts a
  telnet `restart`; if that fails, it exits non-zero so the container
  supervisor restarts it.
- Icecast-KH supports config reload via `SIGHUP` — no restart needed for
  source-password / mount changes.
- All HTTP requests carry the `x-stack-token` header; the control plane
  rejects anything else with 401.

## Files

- `runner.py` — the daemon
- `Dockerfile` — builds the runner image
- `docker-compose.yml` — reference stack (Icecast-KH + Liquidsoap + runner)
- `requirements.txt` — Python deps (just `requests`)
- `.env.example` — copy to `.env` and fill in
