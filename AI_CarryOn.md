# AI_CarryOn.md

> Current-state handoff for THIS project — rewritten in place, always true *now*. History goes in
> `AI_ProgressTracking.md`. How we work (docs, git, config, DB, tests, protocol): **`AI_Standards.md`** — read it.
> Last updated: <YYYY-MM-DD HH:mm — from `Get-Date -Format "yyyy-MM-dd HH:mm:ss K"`>

## ▶▶ START HERE

⚠️ **This is still the template's text.** When the project starts: replace this section with the real
goal, run the wizard, write the project's port here, and append entry #1 to `AI_ProgressTracking.md`.

- **What this is:** a project built from `OteFullStackTemplate_Fastify_React` v2 — Fastify 5 (JS ESM) serves
  the API **and** the built React app on one origin.
- **Set up:** `wizard.bat` (Windows) / `bash wizard.sh` — name, port, database, auth, realtime, demo, launchers,
  install, migrate. It prints the OteServerManager registration.
- **Run (dev):** root `run_windows.bat` / `./run_linux.sh` → http://127.0.0.1:<app.port>. **No watch mode:**
  after changing code, stop it (Ctrl+C) and run it again.
- **Test:** `cd test && npm run test-all` (one command, real exit code; test instance on app.port + 1).
- **Host:** root `server_windows.bat` / `./server_linux.sh` (OteServerManager); update with `scripts/deploy_*`.
- **Port:** `<app.port>` — fill in (the template default 8080 is reserved for the template itself).

## What exists — and what only looks like it exists

✅ **Built and tested (template baseline)**
- API contract `{ ok:true, data }` / `{ ok:false, message, code }` — one error handler (`app/plugins/error-handler.js`).
- **GET + POST only** — the server refuses to boot if a route registers PATCH/PUT/DELETE (`app/plugins/guards.js`).
- Loopback by default (`app.host`), same-origin by default (CORS off unless `app.public_origins`), cross-site
  POSTs refused, startup config check that lists every problem, graceful shutdown, health with DB ping.
- Request logs never store cookies / auth headers / query values / bodies (opt-in, always redacted).
- Database (optional): none · Postgres (SQL migrations own the schema, `npm run db:migrate`, boot guard) ·
  SQLite / MySQL / MariaDB / MSSQL in `sync` mode. Seeds: `npm run db:seed`. Log retention.
- Optional modules (off until enabled in `Backend/config.json`): **auth** (config root, local users,
  Login with Oteracount), **realtime** (SSE + WebSocket from one hub) and **files** (uploads: local
  folder or Bloteb, one API — store only the file id in your rows).
- `test/`: unit (in-process) + live checks; DB checks need `test/test.config.json`.
- Frontend: React + Vite + Tailwind 4, warm token theme (light/dark/system), console at `/console`.

❌ **Not built — don't assume**
- No i18n framework. No admin UI for local users (use `npm run auth:user`).
- Non-Postgres dialects have no SQL migrations (sync mode only).
- The demo feature (`template items`) is an EXAMPLE — replace or remove it (the wizard can).

## Decisions (all reversible — flagged, not buried)
- <project decisions go here, with Ote's words quoted and dated>

## Ownership
- Long-running services Ote runs (this app in production, Postgres, Oteracount, OteServerManager) are **his** —
  never start or stop them. Test against your own instance on the test port (announced; stop it after).

## ⚠️ Traps — do not re-derive
- **Never edit an applied migration** — `db:migrate` and the server refuse it. Add a new numbered file.
- **Don't name a schema in migration SQL** — the runner sets `search_path`.
- **Table names:** `mst_` / `txn_` / `log_` prefix, ONE name end to end (file = define() = tableName = `db.` accessor).
- **The auth session cookie name is per app** (`<app.slug>_session`) — two apps on one host sharing one log
  each other out.
- **Removing the demo later** (after the first migrate): drop its table in a NEW migration; don't delete 002.
- **VS Code "Cannot find type definition file for 'vite/client'"** = `Frontend/node_modules` isn't installed.

## 🚦 Open — needs <owner>
- <parked items, each with who owns the decision>

## Next, in order
1. <the next action>

## Standing rules (always true for this project)
- JSON config (`Backend/config.json`, gitignored; `config.example.json` tracked) — never `.env`.
- GET + POST only. Envelope `{ ok, data }` / `{ ok:false, message, code }`.
- UUID primary key + `rolling_id` + `created_at`/`updated_at` on every table.
- Commits: `OteEnded[type]: <outcome sentence>`, no AI attribution, only when Ote asks. Never track
  `package-lock.json`.
