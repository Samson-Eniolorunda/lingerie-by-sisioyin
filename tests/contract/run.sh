#!/usr/bin/env bash
# Starts the local stack, runs the data-layer contract tests against it, stops it again.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ENV_FILE=$(mktemp)
trap 'bash "$ROOT/tests/support/local-stack/down.sh" >/dev/null 2>&1; rm -f "$ENV_FILE"' EXIT
bash "$ROOT/tests/support/local-stack/up.sh" > "$ENV_FILE" || exit 1
set -a; . "$ENV_FILE"; set +a
export NEXT_PUBLIC_SITE_URL=http://localhost:3100
cd "$ROOT" && npx vitest run --config vitest.contract.config.ts "$@"
