#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  print 'Install Node.js 20.11 or newer, then run this launcher again.'
  exit 1
fi
if [[ ! -d node_modules/three ]]; then
  npm ci
fi
if curl --silent --fail http://127.0.0.1:4173/ | /usr/bin/grep -q 'A Free Throw Study'; then
  open -a 'Google Chrome' http://127.0.0.1:4173 || open http://127.0.0.1:4173
  exit 0
fi
export AFTER_RAIN_OPEN=1
exec node scripts/serve.mjs
