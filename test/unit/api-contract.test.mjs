// The API contract every route follows: { ok:true, data } or { ok:false, message, code }.
// In-process (buildApp + inject) with the database OFF — no port, no DB needed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { testConfig, loadBackend } from "../lib/backend.mjs";

const config = testConfig();
let app;
let backend;

before(async () => {
    backend = await loadBackend(config);
    app = await backend.buildApp(config);
});
after(async () => app?.close());

async function call(method, url, opts = {}) {
    const res = await app.inject({ method, url, ...opts });
    let json = null;
    try {
        json = res.json();
    } catch {
        json = null;
    }
    return { status: res.statusCode, json, headers: res.headers };
}

test("health answers in the envelope and names the service", async () => {
    const r = await call("GET", "/api/health");
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.data.service, config.app.name);
    assert.equal(r.json.data.db, "off");
    assert.match(r.json.data.version, /^\d+\.\d+\.\d+/);
});

test("a DB-backed route with the DB off -> 503 db_disabled", async () => {
    const r = await call("GET", "/api/template-items");
    assert.equal(r.status, 503);
    assert.equal(r.json.code, "db_disabled");
});

test("unknown API route -> 404 envelope with code not_found", async () => {
    const r = await call("GET", "/api/does-not-exist");
    assert.equal(r.status, 404);
    assert.deepEqual([r.json.ok, r.json.code], [false, "not_found"]);
});

test("empty and malformed JSON bodies -> 400 invalid_request (not Fastify's own shape)", async () => {
    for (const payload of ["", "{bad"]) {
        const r = await call("POST", "/api/template-items", { headers: { "content-type": "application/json" }, payload });
        assert.equal(r.status, 400, `payload ${JSON.stringify(payload)}`);
        assert.equal(r.json.ok, false);
        assert.equal(r.json.code, "invalid_request");
    }
});

test("schema validation -> 400 invalid_request with details", async () => {
    const missingName = await call("POST", "/api/template-items", { payload: { summary: "x" } });
    assert.equal(missingName.status, 400);
    assert.equal(missingName.json.code, "invalid_request");
    assert.ok(Array.isArray(missingName.json.details) && missingName.json.details.length > 0);

    const badEnum = await call("POST", "/api/template-items", { payload: { name: "a", status: "bogus" } });
    assert.equal(badEnum.status, 400);

    const badLimit = await call("GET", "/api/template-items?limit=999");
    assert.equal(badLimit.status, 400);
});

test("a malformed :uuid is a 400, never a database error", async () => {
    const r = await call("POST", "/api/template-items/not-a-uuid", { payload: { name: "a" } });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, "invalid_request");
});

test("a server error hides its detail and returns a request_id", async () => {
    const own = await backend.buildApp(config);
    own.get("/api/test-boom", async () => {
        throw new Error("SELECT password FROM secrets failed");
    });
    const res = await own.inject({ method: "GET", url: "/api/test-boom" });
    const body = res.json();
    assert.equal(res.statusCode, 500);
    assert.equal(body.code, "internal_error");
    assert.ok(body.request_id);
    assert.doesNotMatch(body.message, /password|SELECT/);
    await own.close();
});

test("an exposed upstream error keeps its status and code", async () => {
    const own = await backend.buildApp(config);
    own.get("/api/test-upstream", async () => {
        throw new backend.http.UpstreamError("https://auth.example did not answer within 5000 ms", "upstream_timeout", 504);
    });
    const res = await own.inject({ method: "GET", url: "/api/test-upstream" });
    assert.equal(res.statusCode, 504);
    assert.equal(res.json().code, "upstream_timeout");
    await own.close();
});

test("static: a missing file is a 404, a page route gets the SPA", async () => {
    assert.equal((await call("GET", "/missing.png")).status, 404);
    const page = await call("GET", "/console");
    // 200 + html when the frontend is built; 404 text when it isn't — never a file-as-HTML.
    assert.ok(page.status === 200 ? /html/.test(page.headers["content-type"]) : page.status === 404);
});
