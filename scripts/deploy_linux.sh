#!/usr/bin/env bash
# DEPLOY (Linux/macOS): bring this clone up to date WITHOUT starting it.
# git pull (fast-forward only) -> install deps if package.json changed -> build the
# frontend -> apply DB migrations. Stops at the first failure with a non-zero exit code.
# Then restart the server (OteServerManager, systemd, or server_linux.sh at the repo root).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

git pull --ff-only
node scripts/lib/tasks.mjs deploy
