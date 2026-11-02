#!/usr/bin/env bash
# DEPLOY (Linux/macOS): bring this clone up to date WITHOUT starting it.
# git pull (fast-forward only, refuses a clone with local changes) -> install deps if package.json
# changed -> build the frontend -> apply DB migrations. Stops at the first failure (non-zero exit).
# Then restart the server (OteServerManager, systemd, or server_linux.sh at the repo root).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

exec node scripts/lib/tasks.mjs deploy
