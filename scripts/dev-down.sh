#!/usr/bin/env bash
# Stoppa Radio Core dev-miljö.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA="$REPO_ROOT/infra"

echo "■ Stoppar Radio Core (dev)..."
docker compose \
  -f "$INFRA/compose.yml" \
  -f "$INFRA/compose.dev.yml" \
  --env-file "$INFRA/.env" \
  down

echo "✓ Stoppad."
