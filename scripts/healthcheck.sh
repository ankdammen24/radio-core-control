#!/usr/bin/env bash
# Kontrollera att alla endpoints svarar korrekt.
# Användning: scripts/healthcheck.sh [base-url]
# Standard:   http://localhost
set -euo pipefail

BASE="${1:-http://localhost}"
FAIL=0

check() {
  local path="$1"
  local label="$2"
  local url="$BASE$path"

  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")

  if [[ "$http_code" == "200" ]]; then
    echo "  ✓ $label ($url) → $http_code"
  else
    echo "  ✗ $label ($url) → $http_code"
    FAIL=1
  fi
}

echo "▶ Radio Core health check mot: $BASE"
echo ""

check "/health"            "nginx proxy"
check "/api/health"        "radio-core-api"

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✓ Alla endpoints OK"
  exit 0
else
  echo "✗ Ett eller flera endpoints svarade inte korrekt"
  exit 1
fi
