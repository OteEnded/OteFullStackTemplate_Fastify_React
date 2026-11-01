# Backend

Fastify 5, plain JavaScript (ESM). Serves the API under `/api` **and** the built frontend
(`public/dist`, produced by `Frontend` → `npm run build`) on one origin.

## Run

From the repo root use the launchers the wizard creates (`run_*` dev, `server_*` hosting). By hand:

```bash
npm install
npm run db:migrate      # Postgres + schema_mode "migrate" only
npm start               # node server.js  (no watch mode — restart after changes)
node server.js --config other.json      # a second instance on another config
```

## Layout

| Path | What |
|---|---|
| `server.js` | process entry: load config → check it → build → listen → graceful shutdown |
| `app.js` | `buildApp(config)` — builds the app without listening (tests use `inject()`) |
| `app/plugins/` | `guards` (GET+POST only, cross-site POST refused) · `error-handler` (`{ok:false,message,code}`) · `request-logger` (redacted) · `db` · `cron` (guarded jobs, log retention) |
| `app/modules/auth/` | OPTIONAL sign-in: config root · local users · Login with Oteracount (`auth.enabled`) |
| `app/modules/realtime/` | OPTIONAL push: SSE `GET /api/events` + WebSocket `GET /api/ws` (`realtime.*.enabled`) |
| `app/routes/` | `api/` routes + SPA fallback (file paths 404, page routes → `index.html`) |
| `database/` | `migrations/NNN_*.sql` (source of truth) · `models/` (mirror them) · `migrate.js` · `schema-guard.js` · `seed.js` · `query.js` |
| `lib/` | `utility.js` (config + logging) · `config-check.js` · `db-config.js` · `http.js` (outbound with timeout) · `crypto-box.js` · `retention.js` |

## Conventions (enforced, not just documented)

- **Envelope:** `{ ok: true, data }` / `{ ok: false, message, code }`. Throw, and the error handler shapes it;
  5xx detail goes to the log with a `request_id`, never to the client.
- **GET + POST only.** Read with GET; create with `POST /x`, update with `POST /x/:uuid`, actions with
  `POST /x/:uuid/<action>`. A PATCH/PUT/DELETE route makes the server refuse to start.
- **Validate with JSON schemas** on every route (`schema: { params, querystring, body }`).
- **Tables:** `mst_` / `txn_` / `log_`, one name end to end; uuid PK + `rolling_id` + timestamps; the SQL
  migration creates it, the model mirrors it. `test/unit/table-names.test.mjs` checks the naming.
- **Config** is `config.json` only (copy `config.example.json`; its `_comments` explain every key). No `.env`,
  no `PORT` variable.

## Scripts

| npm run | Does |
|---|---|
| `start` | the server |
| `test` | the whole test suite (`../test`) |
| `db:migrate` / `db:status` | apply / list migrations (`-- --baseline NNN` to adopt an existing schema) |
| `db:seed` / `db:reset-demo` | seed rows / reset the demo table |
| `auth:hash-password -- <pw>` | bcrypt hash for `auth.root.password_hash` |
| `auth:user -- list\|add\|set-password\|set-role\|disable\|enable …` | local user accounts |

## Adding a feature (the shape the demo shows)

1. `database/migrations/00N_<name>.sql` — the table (never edit an applied migration).
2. `database/models/<table>.model.js` + register it in `database/models/index.js` (+ `CHOICES` for enums).
3. `app/routes/api/<feature>.route.js` with schemas, `onRequest: fastify.requireSignedIn` /
   `fastify.requirePermission('x')`, and `fastify.realtime.publish(...)` on changes; register it in
   `app/routes/api/index.js`.
4. Tests: `test/unit/<feature>.test.mjs` (in-process) and/or `test/checks/<feature>.check.mjs` (live).
