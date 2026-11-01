#!/usr/bin/env bash
# DEV launcher (Linux/macOS) - created at the repo root by the wizard.
# Installs deps if package.json changed, builds the frontend, applies DB migrations,
# then runs the server in this terminal (Ctrl+C to stop).
# No watch mode: after changing code, stop it and run it again.
# The port is app.port in Backend/config.json.
# For hosting / OteServerManager use server_linux.sh instead.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

node scripts/lib/tasks.mjs dev
cd Backend
exec node server.js
