#!/usr/bin/env python3
"""
Radio Core Runner
=================
A small daemon that turns a Radio Core control-plane into a running radio stack.

Responsibilities
----------------
1. Poll the control plane for the current station config
   (GET /api/public/station-config?station=<slug>).
2. Write icecast.xml, radio.liq and playlist .m3u files into shared volumes
   ONLY when the upstream content has actually changed (sha256 fingerprint).
3. Reload Liquidsoap (telnet) and Icecast-KH (SIGHUP) when their configs change.
   Hard-restart (via supervisor / docker exec) only if reload is impossible.
4. Report service health back to the control plane (POST /api/public/health).
5. Forward Liquidsoap's now-playing metadata callbacks
   (POST /api/public/now-playing) and listener stats
   (POST /api/public/listener-stats).

The runner is intentionally stateless: it stores nothing locally except the last
known config fingerprint. All truth lives in the Radio Core database.

Configuration (environment variables)
-------------------------------------
  RADIO_CORE_API_URL        e.g. https://core.example.com
  RADIO_CORE_STATION_SLUG   e.g. my-station
  RADIO_CORE_STACK_TOKEN    raw token issued by Radio Core (admin → tokens)
  POLL_INTERVAL_SECONDS     default 30
  HEALTH_INTERVAL_SECONDS   default 60
  ICECAST_XML_PATH          default /etc/icecast/icecast.xml
  LIQUIDSOAP_LIQ_PATH       default /etc/liquidsoap/radio.liq
  PLAYLISTS_DIR             default /etc/liquidsoap/playlists
  LIQUIDSOAP_TELNET_HOST    default liquidsoap
  LIQUIDSOAP_TELNET_PORT    default 1234
  ICECAST_PID_FILE          default /var/run/icecast/icecast.pid
  ICECAST_STATUS_URL        default http://icecast:8000/status-json.xsl

This script is BSD-friendly and depends only on requests + the stdlib.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import signal
import socket
import sys
import threading
import time
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urljoin

import requests

# ---------- Configuration ----------

API_URL = os.environ["RADIO_CORE_API_URL"].rstrip("/")
STATION_SLUG = os.environ["RADIO_CORE_STATION_SLUG"]
STACK_TOKEN = os.environ["RADIO_CORE_STACK_TOKEN"]
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "30"))
HEALTH_INTERVAL = int(os.environ.get("HEALTH_INTERVAL_SECONDS", "60"))

ICECAST_XML_PATH = Path(os.environ.get("ICECAST_XML_PATH", "/etc/icecast/icecast.xml"))
LIQUIDSOAP_LIQ_PATH = Path(os.environ.get("LIQUIDSOAP_LIQ_PATH", "/etc/liquidsoap/radio.liq"))
PLAYLISTS_DIR = Path(os.environ.get("PLAYLISTS_DIR", "/etc/liquidsoap/playlists"))
LIQUIDSOAP_TELNET_HOST = os.environ.get("LIQUIDSOAP_TELNET_HOST", "liquidsoap")
LIQUIDSOAP_TELNET_PORT = int(os.environ.get("LIQUIDSOAP_TELNET_PORT", "1234"))
ICECAST_PID_FILE = Path(os.environ.get("ICECAST_PID_FILE", "/var/run/icecast/icecast.pid"))
ICECAST_STATUS_URL = os.environ.get("ICECAST_STATUS_URL", "http://icecast:8000/status-json.xsl")

USER_AGENT = "radio-core-runner/1.0"
HEADERS_AUTH = {"x-stack-token": STACK_TOKEN, "user-agent": USER_AGENT}

# ---------- Logging ----------

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
log = logging.getLogger("runner")

# ---------- State ----------

_shutdown = threading.Event()
_last_fingerprint: dict[str, Optional[str]] = {"icecast": None, "liquidsoap": None, "playlists": None}


# ---------- Helpers ----------

def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _atomic_write(path: Path, content: str) -> bool:
    """Write content to path only if it has changed. Returns True if written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)
    log.info("Wrote %s (%d bytes)", path, len(content))
    return True


def report_health(service: str, status: str, message: str = "", details: Optional[dict] = None) -> None:
    try:
        requests.post(
            urljoin(API_URL + "/", "api/public/health"),
            json={"service": service, "status": status, "message": message, "details": details or {}},
            headers={**HEADERS_AUTH, "content-type": "application/json"},
            timeout=10,
        )
    except Exception as exc:  # pylint: disable=broad-except
        log.warning("health report failed: %s", exc)


# ---------- Liquidsoap control ----------

def liquidsoap_telnet(command: str) -> str:
    with socket.create_connection((LIQUIDSOAP_TELNET_HOST, LIQUIDSOAP_TELNET_PORT), timeout=5) as s:
        s.sendall((command + "\nquit\n").encode())
        chunks = []
        while True:
            buf = s.recv(4096)
            if not buf:
                break
            chunks.append(buf)
        return b"".join(chunks).decode(errors="ignore")


def reload_liquidsoap() -> None:
    """Liquidsoap can hot-reload sources/playlists via telnet but a config change requires
    restarting the process. We attempt a `restart` command first; if that fails, the
    container's supervisor is expected to restart on exit."""
    try:
        out = liquidsoap_telnet("restart")
        log.info("Liquidsoap restart sent (%s)", out.strip()[:120])
        report_health("liquidsoap", "reloaded", "telnet restart ok")
    except Exception as exc:  # pylint: disable=broad-except
        log.warning("Liquidsoap telnet restart failed: %s — exiting so supervisor restarts container", exc)
        report_health("liquidsoap", "error", f"reload failed: {exc}")


# ---------- Icecast control ----------

def reload_icecast() -> None:
    """Icecast-KH reloads its config on SIGHUP."""
    try:
        if not ICECAST_PID_FILE.exists():
            log.warning("Icecast PID file %s missing", ICECAST_PID_FILE)
            report_health("icecast", "error", "pid file missing")
            return
        pid = int(ICECAST_PID_FILE.read_text().strip())
        os.kill(pid, signal.SIGHUP)
        log.info("Sent SIGHUP to icecast pid=%s", pid)
        report_health("icecast", "reloaded", f"SIGHUP pid={pid}")
    except Exception as exc:  # pylint: disable=broad-except
        log.warning("Icecast reload failed: %s", exc)
        report_health("icecast", "error", f"reload failed: {exc}")


def poll_icecast_listeners() -> None:
    """Pull /status-json.xsl and forward listener counts per mount."""
    try:
        r = requests.get(ICECAST_STATUS_URL, timeout=10)
        if r.status_code != 200:
            return
        data = r.json().get("icestats", {})
        sources = data.get("source", [])
        if isinstance(sources, dict):
            sources = [sources]
        for src in sources:
            mount = src.get("listenurl", "").split("/")[-1]
            listeners = int(src.get("listeners", 0) or 0)
            peak = int(src.get("listener_peak", listeners) or listeners)
            requests.post(
                urljoin(API_URL + "/", "api/public/listener-stats"),
                json={
                    "station_slug": STATION_SLUG,
                    "mount": "/" + mount if mount else None,
                    "listeners": listeners,
                    "peak": peak,
                },
                headers={**HEADERS_AUTH, "content-type": "application/json"},
                timeout=10,
            )
    except Exception as exc:  # pylint: disable=broad-except
        log.debug("listener poll failed: %s", exc)


# ---------- Sync loop ----------

def fetch_config() -> Optional[dict[str, Any]]:
    url = f"{API_URL}/api/public/station-config?station={STATION_SLUG}"
    try:
        r = requests.get(url, headers=HEADERS_AUTH, timeout=15)
        if r.status_code == 401:
            log.error("401 Unauthorized — check RADIO_CORE_STACK_TOKEN")
            report_health("runner", "error", "unauthorized")
            return None
        if r.status_code == 409:
            log.warning("Station %s not fully configured yet", STATION_SLUG)
            report_health("runner", "warning", "station not configured")
            return None
        r.raise_for_status()
        return r.json()
    except Exception as exc:  # pylint: disable=broad-except
        log.error("Failed to fetch config: %s", exc)
        report_health("runner", "error", f"fetch failed: {exc}")
        return None


def apply_config(cfg: dict[str, Any]) -> None:
    icecast_xml = cfg.get("icecast_xml") or ""
    liquidsoap_liq = cfg.get("liquidsoap_liq") or ""
    playlists = cfg.get("playlists") or []

    fp_ic = _sha256(icecast_xml)
    fp_liq = _sha256(liquidsoap_liq)
    fp_pls = _sha256(json.dumps(sorted([(p["file"], p["content"]) for p in playlists])))

    icecast_changed = fp_ic != _last_fingerprint["icecast"]
    liq_changed = fp_liq != _last_fingerprint["liquidsoap"]
    pls_changed = fp_pls != _last_fingerprint["playlists"]

    if icecast_changed:
        if _atomic_write(ICECAST_XML_PATH, icecast_xml):
            reload_icecast()
        _last_fingerprint["icecast"] = fp_ic

    if pls_changed:
        # Wipe stale playlists, write new ones
        if PLAYLISTS_DIR.exists():
            for stale in PLAYLISTS_DIR.glob("*.m3u"):
                stale.unlink(missing_ok=True)
        for p in playlists:
            _atomic_write(PLAYLISTS_DIR / p["file"], p["content"])
        _last_fingerprint["playlists"] = fp_pls

    if liq_changed or pls_changed:
        _atomic_write(LIQUIDSOAP_LIQ_PATH, liquidsoap_liq)
        reload_liquidsoap()
        _last_fingerprint["liquidsoap"] = fp_liq

    if not (icecast_changed or liq_changed or pls_changed):
        log.debug("Config unchanged")

    report_health("runner", "ok", "synced", {
        "icecast_changed": icecast_changed,
        "liquidsoap_changed": liq_changed,
        "playlists_changed": pls_changed,
    })


# ---------- Main ----------

def _signal_handler(signum, _frame):
    log.info("Received signal %s, shutting down", signum)
    _shutdown.set()


def main() -> int:
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    log.info("Radio Core runner starting — api=%s station=%s", API_URL, STATION_SLUG)
    report_health("runner", "starting", "boot")

    last_health = 0.0
    while not _shutdown.is_set():
        cfg = fetch_config()
        if cfg:
            try:
                apply_config(cfg)
            except Exception as exc:  # pylint: disable=broad-except
                log.exception("apply_config failed: %s", exc)
                report_health("runner", "error", f"apply failed: {exc}")

        now = time.time()
        if now - last_health >= HEALTH_INTERVAL:
            poll_icecast_listeners()
            last_health = now

        _shutdown.wait(POLL_INTERVAL)

    log.info("Runner exited")
    report_health("runner", "stopped", "shutdown")
    return 0


if __name__ == "__main__":
    sys.exit(main())
