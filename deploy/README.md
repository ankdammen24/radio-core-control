# Radio Core – Reference Deployment (Runtime VPS)

## Architecture layer

This directory contains the **Runtime / Broadcast Engine** layer of Radio Core.
It deploys as a self-contained Docker Compose stack on a broadcast VPS. The
only external dependency is a reachable Radio Core control plane URL.

Components:
- **Icecast-KH** — streaming server (listener-facing)
- **Liquidsoap** — audio engine (fetches media via HTTP from R2/CDN in Fas 5+)
- **Runner** — stateless agent (polls config, writes files, reports health)
- **Stereo Tool** — optional audio processor (requires license)

See: `docs/architecture/radio-core-v2.md` §2.3 and Fas 6 for the full runtime spec.

---

A complete "radio in a box" stack driven entirely by the Radio Core control
plane. Everything (Icecast config, Liquidsoap script, playlists, schedule) is
generated from the database and synced down by the runner – there are no
config files for you to edit by hand.

## Requirements

- Docker Engine 24+ and the Docker Compose plugin
- A reachable Radio Core control plane (cloud or self-hosted)
- A station + stack token created in the Radio Core admin UI

## Quick start

```bash
cp .env.example .env
# edit .env and fill in RADIO_CORE_API_URL, STATION_SLUG and STACK_TOKEN
docker compose up -d
docker compose logs -f runner
```

The runner will:

1. Fetch the station config from `${RADIO_CORE_API_URL}/api/public/station-config`
2. Write `icecast.xml`, `radio.liq` and playlists into the shared volumes
3. Reload Icecast (SIGHUP) and Liquidsoap (telnet `restart`) when content changes
4. Report service health and listener stats back to the control plane

Public stream is then available on `http://<host>:8000/<mountpoint>`.

## Services

| Service     | Image                                       | Purpose                          |
|-------------|---------------------------------------------|----------------------------------|
| icecast     | `ghcr.io/karlheyes/icecast-kh-docker`       | Streaming server                 |
| liquidsoap  | `savonet/liquidsoap:v2.2.5`                 | Audio engine / encoder           |
| runner      | built from `../runner`                      | Config sync + health reporter    |

## Volumes

| Volume              | Mounted in                  | Contents                       |
|---------------------|-----------------------------|--------------------------------|
| `icecast-config`    | icecast, runner             | Generated `icecast.xml`        |
| `icecast-run`       | icecast, runner             | PID file (used for SIGHUP)     |
| `icecast-logs`      | icecast                     | Access + error logs            |
| `liquidsoap-config` | liquidsoap, runner          | `radio.liq` + playlists        |
| `media`             | liquidsoap, runner          | Audio files (shared library)   |

## Stereo Tool (optional)

Mount a host folder containing your licensed Thimeo Stereo Tool binary and
presets by setting `STEREO_TOOL_DIR` in `.env`. It is exposed read-only at
`/opt/stereo-tool` inside the Liquidsoap container.

## Updating

```bash
docker compose pull
docker compose up -d
```

The runner repolls the control plane on `POLL_INTERVAL_SECONDS` (default 30 s),
so configuration changes you make in the Radio Core UI propagate automatically –
no restart required.

## Troubleshooting

- `docker compose logs runner` – sync activity, health reports
- `docker compose logs liquidsoap` – playout errors, decoder issues
- `docker compose logs icecast` – listener connections, mount errors
- Liquidsoap waits for `radio.liq` on first boot; if it never appears, check
  that the runner can reach `RADIO_CORE_API_URL` and that the stack token is
  valid.
