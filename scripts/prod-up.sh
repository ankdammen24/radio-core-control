#!/usr/bin/env bash
# Starta Radio Core i produktion.
# Kör på Linux-servern efter git pull + eventuellt bygge.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA="$REPO_ROOT/infra"

if [[ ! -f "$INFRA/.env" ]]; then
  echo "✗ infra/.env saknas. Kopiera infra/.env.example och fyll i värden."
  exit 1
fi

echo "▶ Bygger och startar Radio Core (produktion)..."
docker compose \
  -f "$INFRA/compose.yml" \
  -f "$INFRA/compose.production.yml" \
  --env-file "$INFRA/.env" \
  up -d --build --remove-orphans

echo ""
echo "✓ Kör. Kontrollera status:"
echo "  docker compose -f infra/compose.yml ps"
echo ""
echo "Health checks:"
echo "  curl http://localhost/health"
echo "  curl http://localhost/api/health"
