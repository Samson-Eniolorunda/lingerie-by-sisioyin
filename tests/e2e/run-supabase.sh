#!/usr/bin/env bash
# Builds the app against the local test stack (PostgreSQL plus the local Supabase stand-in) and runs
# the Playwright suite with DATA_MODE=supabase. Local only. Extra arguments go to Playwright.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ENV_FILE=$(mktemp)
trap 'bash "$ROOT/tests/support/local-stack/down.sh" >/dev/null 2>&1; rm -f "$ENV_FILE"' EXIT
bash "$ROOT/tests/support/local-stack/up.sh" > "$ENV_FILE" || exit 1
set -a; . "$ENV_FILE"; set +a
export NEXT_PUBLIC_SITE_URL=http://localhost:3100 CRON_SECRET=local-test-cron-secret-0123456789abcdef LBS_E2E_DATA=supabase
cd "$ROOT" || exit 1
npx next build || exit 1
npx playwright test --trace off "$@"
