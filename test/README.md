# test/

The project's tests live INSIDE the project (one folder, its own `package.json`). No test
dependencies to install for unit + checks — they use Node's built-in `node:test` and the
backend's own modules. The UI drives need `npm install` here (Playwright; it drives the
installed Microsoft Edge, so no browser download on Windows).

```bash
cd test
npm run test-all        # everything below — ONE command, real exit code
npm run unit            # unit/ only
npm run checks          # checks/ only
npm run ui              # everything + ui/ drives  (= test-all --ui; build the frontend first)
HEADED=1 node ui/console-ui.mjs   # one drive, in a visible browser
npm run ui:all          # the UI drives in Edge, Firefox AND WebKit (Safari's engine)
UI_BROWSER=webkit node ui/console-ui.mjs   # one drive in one browser
```
Firefox/WebKit need `npx playwright install firefox webkit` once per machine. WebKit is the closest
to Safari off a Mac (real Safari needs macOS); it caught a real Safari focus bug in the dialog.
```bash
```
(`npm test` in `Backend/` runs `test-all` too.)

| Folder | What | Needs |
|---|---|---|
| `unit/*.test.mjs` | `node:test`, **in-process**: `buildApp(config)` + `app.inject()` — no port, no DB | nothing |
| `checks/*.check.mjs` | **live** probes against a PRIVATE instance on the test port (`app.port + 1`, i.e. 8081) | port free |
| `checks/database.check.mjs` | the app against a real DB, in its own `<project>_test` schema (dropped after) | `test/test.config.json` — else **SKIPPED** |
| `pipeline/test-all.mjs` | runs all of the above, judges each suite by its PASS line | — |
| `ui/*-ui.mjs` | Playwright drives against a private instance serving the BUILT frontend: every page in light + dark at desktop + 375px, theme pre-paint, no sideways scroll, no console errors, demo flows (on a mocked items API). Screenshots → `shots/active/` (gitignored) — **look at them** | `npm install`, `npm run build` in Frontend, port free |
| `lib/` | `backend.mjs` (test config, start/stop a test server), `checker.mjs` (the checks contract), `ui.mjs` (browser, pages, screenshots) | — |

## Rules

- Tests never read `Backend/config.json` — they derive a config from `config.example.json`.
- A check ends with exactly one of `ALL CHECKS PASSED (n)` · `SKIPPED: <reason>` · `<n> CHECK(S) FAILED`.
- **Run a new test against the OLD code first** — an assertion that already passes proves nothing.
- A check that cannot start its server reports THAT (e.g. "test port 8081 is already in use"), not a
  product failure. If a run was killed, check for a leftover test instance before believing a failure.
- DB tests only ever touch their own `<project>_test` schema; use a non-superuser test account.
- Never test against a service someone else is running (dev or prod instance) — start your own.

## Adding a test

- Pure function or a route's behaviour → `unit/<area>.test.mjs` (copy `api-contract.test.mjs`).
- Needs the real process, files, ports or DB → `checks/<area>.check.mjs` (copy `server.check.mjs`).
