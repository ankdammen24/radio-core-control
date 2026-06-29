#!/usr/bin/env bash
# Starta Radio Core i dev-läge (med pgAdmin, Mailpit, lokal DB).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA="$REPO_ROOT/infra"

echo "▶ Startar Radio Core (dev)..."
docker compose \
  -f "$INFRA/compose.yml" \
  -f "$INFRA/compose.dev.yml" \
  --env-file "$INFRA/.env" \
  up -d --build

echo ""
echo "✓ Kör. Tillgängliga tjänster:"
echo "  API:        http://localhost:3000/api/health"
echo "  Media:      http://localhost:3001/api/health"
echo "  pgAdmin:    http://localhost:5050"
echo "  Mailpit:    http://localhost:8025"
echo "  Redis:      localhost:6379"
echo "  MongoDB:    localhost:27017"
echo "  PostgreSQL: localhost:5432"
echo ""
echo "Loggar: scripts/dev-logs.sh"
