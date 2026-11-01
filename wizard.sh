#!/usr/bin/env bash
# Setup wizard (Linux/macOS). Run once after cloning; re-runnable.
# The logic lives in scripts/wizard.mjs (shared with wizard.bat).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 or newer is required - install it from https://nodejs.org and run the wizard again."
  exit 1
fi

exec node scripts/wizard.mjs "$@"
