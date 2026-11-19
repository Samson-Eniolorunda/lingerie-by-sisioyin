#!/usr/bin/env bash
# Starts the local test stack: a throwaway PostgreSQL 16 with supabase/baseline applied, and the
# local stand-in for the Supabase HTTP API (server.mjs) in front of it. Local only; no network.
# Usage: up.sh   (prints the environment variable names and values to use, to stdout)
#        down.sh stops it again.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
if [ "$(id -u)" = "0" ]; then
  id pgtest >/dev/null 2>&1 || useradd -m pgtest
  chmod -R a+rX "$ROOT/tests" "$ROOT/supabase" "$ROOT/src/data" "$ROOT/node_modules" 2>/dev/null || true
  exec runuser -u pgtest -- env PATH="$PATH" bash "$HERE/up.sh" "$@"
fi
BIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
DIR=${LBS_STACK_DIR:-/tmp/lbs-stack}
PGPORT=${LBS_PG_PORT:-54329}
API_PORT=${LBS_STACK_PORT:-54321}
if [ -f "$DIR/server.pid" ]; then bash "$HERE/down.sh" >/dev/null 2>&1 || true; fi
rm -rf "$DIR"; mkdir -p "$DIR"
"$BIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
"$BIN/pg_ctl" -D "$DIR/data" -o "-p $PGPORT -k $DIR -c listen_addresses=127.0.0.1 -c fsync=off" -w -l "$DIR/pg.log" start >/dev/null
export PGHOST=127.0.0.1 PGPORT=$PGPORT PGUSER=postgres
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE lbs" >/dev/null
export PGDATABASE=lbs PGOPTIONS="-c client_min_messages=warning"
for f in "$ROOT/tests/sql/stubs.sql" "$HERE/shim.sql" "$ROOT/supabase/baseline/0000_baseline.sql" \
         "$ROOT/supabase/baseline/0001_receipts_bucket.sql" "$ROOT/supabase/baseline/0002_messages_and_admin_reports.sql"; do
  psql -X -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
export LBS_DATABASE_URL="postgres://postgres@127.0.0.1:$PGPORT/lbs" LBS_STACK_PORT=$API_PORT LBS_STORAGE_DIR="$DIR"
nohup node "$HERE/server.mjs" > "$DIR/server.log" 2>&1 &
echo $! > "$DIR/server.pid"
for _ in $(seq 1 50); do curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1 && break; sleep 0.2; done
curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null || { cat "$DIR/server.log"; exit 1; }
node --no-warnings "$HERE/seed.mjs" >&2
KEYS=$(curl -fsS "http://127.0.0.1:$API_PORT/keys")
node -e '
const k = JSON.parse(process.argv[1]);
console.log(`NEXT_PUBLIC_SUPABASE_URL=${k.url}`);
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${k.anon}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${k.service}`);
' "$KEYS"
