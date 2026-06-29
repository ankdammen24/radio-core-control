#!/usr/bin/env bash
# Visa loggar från alla produktionstjänster (follow mode).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA="$REPO_ROOT/infra"

SERVICE="${1:-}"  # valfri: scripts/prod-logs.sh nginx-proxy

docker compose \
  -f "$INFRA/compose.yml" \
  -f "$INFRA/compose.production.yml" \
  --env-file "$INFRA/.env" \
  logs -f --tail=100 $SERVICE
