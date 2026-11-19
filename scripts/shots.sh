#!/usr/bin/env bash
# Rebuilds, restarts the production server on :3100 and captures screenshots (development helper).
set -e
cd "$(dirname "$0")/.."
npx next build > /tmp/claude-0/build.log 2>&1 || { tail -30 /tmp/claude-0/build.log; exit 1; }
fuser -k 3100/tcp >/dev/null 2>&1 || true
sleep 1
(npx next start -p 3100 > /tmp/claude-0/next.log 2>&1 &)
sleep 3
CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/screenshots.mjs
