#!/usr/bin/env bash
# Testa nginx-konfiguration utan att starta om containern.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "▶ Testar nginx-konfiguration..."

# Kör nginx -t i den körande containern (om den finns)
if docker ps --format '{{.Names}}' | grep -q "radio-core-nginx-proxy\|nginx-proxy"; then
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "radio-core-nginx-proxy|nginx-proxy" | head -1)
  echo "Container: $CONTAINER"
  docker exec "$CONTAINER" nginx -t
else
  # Kör en engångskontainer med samma volymer
  docker run --rm \
    -v "$REPO_ROOT/infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
    -v "$REPO_ROOT/infra/nginx/conf.d:/etc/nginx/conf.d:ro" \
    nginx:stable-alpine nginx -t
fi

echo "✓ Nginx-config OK"
