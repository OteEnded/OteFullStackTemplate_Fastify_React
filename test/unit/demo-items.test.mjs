// DEMO feature tests (/api/template-items). Deleted together with the demo by the wizard.
// In-process with the database OFF: checks the route's schemas, which run before the handler.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { testConfig, loadBackend } from "../lib/backend.mjs";

const config = testConfig();
let app;

before(async () => {
    const backend = await loadBackend(config);
    app = await backend.buildApp(config);
});
after(async () => app?.close());

const call = async (method, url, opts = {}) => {
    const res = await app.inject({ method, url, ...opts });
    return { status: res.statusCode, json: res.json() };
};

test("with the DB off the demo routes answer 503 db_disabled", async () => {
    const r = await call("GET", "/api/template-items");
    assert.equal(r.status, 503);
    assert.equal(r.json.code, "db_disabled");
});

test("create body schema: name required, status/priority from CHOICES", async () => {
    assert.equal((await call("POST", "/api/template-items", { payload: { summary: "x" } })).status, 400);
    assert.equal((await call("POST", "/api/template-items", { payload: { name: "a", status: "bogus" } })).status, 400);
});

test("a malformed :uuid is a 400, never a database error", async () => {
    const r = await call("POST", "/api/template-items/not-a-uuid", { payload: { name: "a" } });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, "invalid_request");
});

test("list query schema: limit above 200 is refused", async () => {
    assert.equal((await call("GET", "/api/template-items?limit=999")).status, 400);
});
