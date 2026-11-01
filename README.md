# Ote's FullStack Template — Fastify + React (v2)

A working baseline, not an empty shell: Fastify 5 serves the API **and** the built React app on
one origin, with the conventions Ote's real projects kept re-adding built in and enforced.

```
Backend/    Fastify 5, plain JS (ESM) — API under /api, serves Frontend's build
Frontend/   React 19 + Vite + Tailwind 4 — public page at /, console at /console
test/       unit (in-process) + live checks + UI drives — one command, real exit code
scripts/    wizard + launchers (one Node implementation for Windows and Linux)
AI_*.md     AI_Standards (how we work) · AI_CarryOn (current state) · AI_ProgressTracking (history)
```

## Start a project from it

Requires **Node.js 24+** (and Git). Windows-first; Linux works the same.

1. Clone it. Make the **first commit of your project the pristine template**.
2. Run the wizard: **`wizard.bat`** (Windows) or **`bash wizard.sh`**. It asks for the app name, an
   allocated port, the database, sign-in, realtime, whether to remove the demo, and your OS, then
   writes `Backend/config.json`, generates secrets, creates the launchers, installs, builds, migrates,
   and prints the **OteServerManager** registration. (`--answers file.json` for unattended runs.)
3. Dev: **`run_windows.bat`** / **`./run_linux.sh`** → `http://127.0.0.1:<port>`. No watch mode —
   after changing code, stop it (Ctrl+C) and run it again.
4. Fill in `AI_CarryOn.md`'s START HERE and entry #1 of `AI_ProgressTracking.md` (see `AI_Standards.md`).

Hosting: root **`server_windows.bat`** / **`./server_linux.sh`** (non-interactive, exits with the
server's own code — register it in OteServerManager); update with **`scripts/deploy_*`** (pull, install,
build, migrate). Details: `scripts/README.md`.

## What's in the box

| | |
|---|---|
| **API contract** | `{ ok: true, data }` / `{ ok: false, message, code }` from one error handler; JSON-schema validation on routes |
| **GET + POST only** | the server refuses to start if a route registers PATCH/PUT/DELETE |
| **Safe defaults** | binds `127.0.0.1`, same-origin (CORS off unless `app.public_origins`), cross-site POSTs refused, a startup config check that lists every problem, graceful shutdown, `/api/health` with a DB ping |
| **Logs** | file-only by default; request logs never keep cookies, auth headers, query values or bodies (opt-in, redacted); retention |
| **Database** (optional) | none · **Postgres** — SQL migrations own the schema (`npm run db:migrate`, run-once ledger, the server refuses pending/edited migrations) · SQLite / MySQL / MariaDB / MSSQL in `sync` mode. Tables `mst_` / `txn_` / `log_`, uuid PK + `rolling_id` |
| **Sign-in** (optional module) | config root · local users (`npm run auth:user`) · **Login with Oteracount**; sealed per-app session cookie, rate-limited, permission checks |
| **Realtime** (optional module) | SSE (`/api/events`) + WebSocket (`/api/ws`) from one `fastify.realtime.publish()` |
| **Frontend** | warm token theme (light / dark / system, no flash), self-hosted Space Grotesk + Noto Sans Thai, lucide icons, a copy-in component kit (dialog, confirm, menu, toasts, table…), console shell with a phone drawer |
| **Tests** | `cd test && npm run test-all` (`npm run ui` adds the browser drives + screenshots) |
| **Demo** | "template items" — a list + form + confirm feature to copy and then delete (the wizard can) |

## Docs

| File | Read it for |
|---|---|
| `AI_Standards.md` | how Ote works: the doc system, git, config, ports, database, testing, the protocol |
| `Backend/README.md` | backend layout, conventions, npm scripts, how to add a feature |
| `Frontend/README.md` | routes, layout, tokens-only rule, components |
| `scripts/README.md` | wizard, launchers, deploy, OteServerManager |
| `test/README.md` | test tiers and rules |
| `Backend/config.example.json` | every config key, explained in its `_comments` |

## Notes

- Config is JSON (`Backend/config.json`, gitignored) — never `.env`. Lockfiles are not tracked.
- VS Code says *"Cannot find type definition file for 'vite/client'"*? `Frontend/node_modules` isn't
  installed — run the wizard or the dev launcher.
- A SQLite project can't use the portable-EXE build (`sqlite3` is a native module); everything else
  in the template is pure JS.
