# scripts/

Everything that sets up, runs and deploys the project. Scripts are named by OS
(`_windows` / `_linux`) so you can't run the wrong one when extensions are hidden.
The logic lives in **Node** (`wizard.mjs`, `lib/tasks.mjs`) — one implementation for both
OSes; the `.bat` / `.sh` files are thin wrappers. Node.js 24+ is the only prerequisite.

## 1. First: the wizard (repo root)

| Windows      | Linux/macOS     |
| ------------ | --------------- |
| `wizard.bat` | `bash wizard.sh` |

Asks for the app name, port (never 3000; 8080 is the template's own), whether to serve
the LAN, the database (none · Postgres · SQLite · MySQL/MariaDB/MSSQL), whether to
**remove the demo** (do it before the first migrate), and which OS — then writes
`Backend/config.json`, generates secrets, creates the root launchers, installs the
dependencies (this is also what clears VS Code's *"Cannot find type definition file for
'vite/client'"* — that only means `Frontend/node_modules` isn't installed), applies the
migrations, and prints the **OteServerManager registration**. Re-runnable.
Unattended: `node scripts/wizard.mjs --answers answers.json`.

## 2. Launchers it creates at the repo root

| Windows              | Linux/macOS         | Does |
| -------------------- | ------------------- | ---- |
| `run_windows.bat`    | `./run_linux.sh`    | **Dev.** Install deps *if package.json changed* → build frontend → migrate → run in this window. No watch mode: stop it and run it again after changing code. |
| `server_windows.bat` | `./server_linux.sh` | **Hosting / OteServerManager.** Non-interactive (no prompts, no pause), foreground, `NODE_ENV=production`. Does NOT install or build — checks they were done, migrates, starts. **Exits with the server's exit code**, so a crash is never reported as a clean stop. |

They are generated (gitignored) because each machine picks its OS.

## 3. Deploy (run from anywhere)

| Windows                      | Linux/macOS                  | Does |
| ---------------------------- | ---------------------------- | ---- |
| `scripts\deploy_windows.bat` | `bash scripts/deploy_linux.sh` | `git pull --ff-only` → install if changed → build → migrate. Stops at the first failure (non-zero exit). Does not start anything — restart the server afterwards. |

## OteServerManager

The wizard prints the exact values. In short:
`start_command` = the root `server_windows.bat` · `working_dir` = the repo root ·
port from config: `port_config_file` `Backend\config.json`, `port_config_key` `app.port` ·
health check `http://127.0.0.1:<port>/api/health` (names the service, pings the DB).

## Files

- `wizard.mjs` — the setup wizard.
- `lib/tasks.mjs` — `dev` / `server` / `deploy` steps shared by every launcher.
- `lib/demo.mjs` — removes the demo feature: the files in `DEMO_FILES` + every line marked
  `// @demo` or block between `@demo-start` / `@demo-end`. Keep the markers when you touch demo code.
- `launchers/` — the launcher templates the wizard copies to the root (not run from here).
