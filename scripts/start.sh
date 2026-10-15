#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
test -f .env || { echo 'Copy .env.example to .env and configure a provider first.'; exit 1; }
exec node --env-file=.env server.mjs
