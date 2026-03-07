#!/usr/bin/env bash
set -euo pipefail

URL="${DOCMOST_TEST_URL:-http://localhost:4010}"
MAX_WAIT=120
WAITED=0

echo "Waiting for Docmost at $URL ..."

until curl -sf "$URL/api/health" > /dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: Docmost did not become healthy within ${MAX_WAIT}s"
    exit 1
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  echo "  ... waiting (${WAITED}s)"
done

echo "Docmost is ready (${WAITED}s)"
