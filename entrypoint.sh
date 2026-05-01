#!/bin/sh
set -e

CONFIG_FILE="${CONFIG_PATH:-/app/config/config.yaml}"
if [ -f "$CONFIG_FILE" ]; then
  chown app:app "$CONFIG_FILE" 2>/dev/null || true
fi

exec su-exec app dumb-init -- "$@"
