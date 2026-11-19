#!/usr/bin/env bash
# Runs the SQL tests against a throwaway local PostgreSQL (no Supabase, no network).
# Usage: tests/sql/run.sh [test-file ...]   (default: every tests/sql/[0-9]*.sql)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

# PostgreSQL will not run as root: re-run this script as an unprivileged user.
if [ "$(id -u)" = "0" ]; then
  id pgtest >/dev/null 2>&1 || useradd -m pgtest
  chmod -R a+rX "$ROOT/tests/sql" "$ROOT/supabase"
  exec runuser -u pgtest -- bash "$HERE/run.sh" "$@"
fi

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
[ -x "$BIN/initdb" ] || { echo "PostgreSQL server binaries not found" >&2; exit 2; }
DIR=$(mktemp -d)
PORT=${PGTEST_PORT:-54329}
cleanup() { "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

"$BIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
"$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -w -l "$DIR/log" start >/dev/null
export PGHOST="$DIR" PGPORT="$PORT" PGUSER=postgres
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "CREATE DATABASE lbs" >/dev/null
export PGDATABASE=lbs
LOAD=(env PGOPTIONS="-c client_min_messages=warning" "${PSQL[@]}")
"${LOAD[@]}" -f "$HERE/stubs.sql" >/dev/null
"${LOAD[@]}" -f "$ROOT/supabase/baseline/0000_baseline.sql" >/dev/null
"${LOAD[@]}" -f "$ROOT/supabase/baseline/0001_receipts_bucket.sql" >/dev/null
"${LOAD[@]}" -f "$ROOT/supabase/baseline/0002_messages_and_admin_reports.sql" >/dev/null
"${LOAD[@]}" -f "$HERE/helpers.sql" >/dev/null
echo "Baseline applied to a fresh database."

FILES=("$@")
[ ${#FILES[@]} -gt 0 ] || FILES=("$HERE"/[0-9]*.sql)
FAILED=0; PASSED=0
for f in "${FILES[@]}"; do
  # Each file runs in one transaction that is rolled back, so files are independent.
  STATUS=0
  OUT=$( { echo "BEGIN;"; cat "$f"; echo "ROLLBACK;"; } | "${PSQL[@]}" 2>&1 ) || STATUS=$?
  N=$(printf '%s\n' "$OUT" | grep -c 'NOTICE:  ok - ' || true)
  if [ $STATUS -eq 0 ]; then
    echo "PASS $(basename "$f"): $N checks"; PASSED=$((PASSED + N))
  else
    echo "FAIL $(basename "$f") (after $N checks)"
    printf '%s\n' "$OUT" | grep -E 'FAIL|ERROR|DETAIL|CONTEXT' | head -8; FAILED=1
  fi
done
echo "Total checks passed: $PASSED"
exit $FAILED
