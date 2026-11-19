#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ "$(id -u)" = "0" ]; then exec runuser -u pgtest -- env PATH="$PATH" bash "$HERE/down.sh"; fi
DIR=${LBS_STACK_DIR:-/tmp/lbs-stack}
BIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
[ -f "$DIR/server.pid" ] && kill "$(cat "$DIR/server.pid")" 2>/dev/null
"$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1
rm -rf "$DIR"
