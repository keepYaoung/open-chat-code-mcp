#!/bin/zsh
set -euo pipefail

APP_DIR=/Users/REPLACE_WITH_YOUR_USERNAME/Library/Application Support/cokacremote/app
ENV_FILE="$APP_DIR/config/cokacremote.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

cd "$APP_DIR"
exec /opt/homebrew/bin/node "$APP_DIR/dist/src/server.js"
