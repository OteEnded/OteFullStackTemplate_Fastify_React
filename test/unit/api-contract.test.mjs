// The API contract every route follows: { ok:true, data } or { ok:false, message, code }.
// In-process (buildApp + inject) with the database OFF — no port, no DB needed.
// Uses its own test routes, so it holds whether or not the demo feature exists.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { testConfig, loadBackend } from "../lib/backend.mjs";

const config = testConfig();
let app;
let backend;

before(async () => {
    backend = await loadBackend(config);
    app = await backend.buildApp(config);
    app.post("/api/test-validate", {
        schema: { body: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1 } } } },
    }, async (request) => ({ ok: true, data: request.body }));
    app.get("/api/test-boom", async () => {
        throw new Error("SELECT password FROM secrets failed");
    });
    app.get("/api/test-upstream", async () => {
        throw new backend.http.UpstreamError("https://auth.example did not answer within 5000 ms", "upstream_timeout", 504);
    });
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

test("unknown API route -> 404 envelope with code not_found", async () => {
    const r = await call("GET", "/api/does-not-exist");
    assert.equal(r.status, 404);
    assert.deepEqual([r.json.ok, r.json.code], [false, "not_found"]);
});

test("empty and malformed JSON bodies -> 400 invalid_request (not Fastify's own shape)", async () => {
    for (const payload of ["", "{bad"]) {
        const r = await call("POST", "/api/test-validate", { headers: { "content-type": "application/json" }, payload });
        assert.equal(r.status, 400, `payload ${JSON.stringify(payload)}`);
        assert.equal(r.json.ok, false);
        assert.equal(r.json.code, "invalid_request");
    }
});

test("schema validation -> 400 invalid_request with details; valid input passes", async () => {
    const bad = await call("POST", "/api/test-validate", { payload: { other: "x" } });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.code, "invalid_request");
    assert.ok(Array.isArray(bad.json.details) && bad.json.details.length > 0);

    const good = await call("POST", "/api/test-validate", { payload: { name: "a" } });
    assert.deepEqual([good.status, good.json.ok], [200, true]);
});

test("a server error hides its detail and returns a request_id", async () => {
    const r = await call("GET", "/api/test-boom");
    assert.equal(r.status, 500);
    assert.equal(r.json.code, "internal_error");
    assert.ok(r.json.request_id);
    assert.doesNotMatch(r.json.message, /password|SELECT/);
});

test("an exposed upstream error keeps its status and code", async () => {
    const r = await call("GET", "/api/test-upstream");
    assert.equal(r.status, 504);
    assert.equal(r.json.code, "upstream_timeout");
});

test("static: a missing file is a 404, a page route gets the SPA", async () => {
    assert.equal((await call("GET", "/missing.png")).status, 404);
    const page = await call("GET", "/console");
    // 200 + html when the frontend is built; 404 text when it isn't — never a file-as-HTML.
    assert.ok(page.status === 200 ? /html/.test(page.headers["content-type"]) : page.status === 404);
});
