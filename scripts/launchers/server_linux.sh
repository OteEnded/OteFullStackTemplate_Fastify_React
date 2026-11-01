#!/usr/bin/env bash
# SERVER launcher (Linux/macOS) - created at the repo root by the wizard.
# For hosting and for OteServerManager / systemd: non-interactive, runs in the
# foreground, and `exec`s the server so signals reach it and its exit code is ours.
# It does NOT install or build (deploy_linux.sh does) - it checks they were done,
# applies pending DB migrations, then starts in production.
# The port is app.port in Backend/config.json.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
export NODE_ENV=production

node scripts/lib/tasks.mjs server
cd Backend
exec node server.js
