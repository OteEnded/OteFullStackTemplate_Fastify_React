# test/

The project's tests live INSIDE the project (one folder, its own `package.json`). No test
dependencies to install for unit + checks — they use Node's built-in `node:test` and the
backend's own modules.

```bash
cd test
npm run test-all        # everything below — ONE command, real exit code
npm run unit            # unit/ only
npm run checks          # checks/ only
```
(`npm test` in `Backend/` runs `test-all` too.)

| Folder | What | Needs |
|---|---|---|
| `unit/*.test.mjs` | `node:test`, **in-process**: `buildApp(config)` + `app.inject()` — no port, no DB | nothing |
| `checks/*.check.mjs` | **live** probes against a PRIVATE instance on the test port (`app.port + 1`, i.e. 8081) | port free |
| `checks/database.check.mjs` | the app against a real DB, in its own `<project>_test` schema (dropped after) | `test/test.config.json` — else **SKIPPED** |
| `pipeline/test-all.mjs` | runs all of the above, judges each suite by its PASS line | — |
| `lib/` | `backend.mjs` (test config, start/stop a test server), `checker.mjs` (the checks contract) | — |

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
