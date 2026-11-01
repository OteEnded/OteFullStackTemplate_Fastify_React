// ⭐ GET + POST only (Ote, 2026-11-01) and the cross-site POST guard.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { testConfig, loadBackend } from "../lib/backend.mjs";

const config = testConfig();
let backend;
let app;

before(async () => {
    backend = await loadBackend(config);
    app = await backend.buildApp(config);
});
after(async () => app?.close());

test("registering a PATCH/PUT/DELETE route fails at boot with the rule in the message", async () => {
    for (const method of ["delete", "put", "patch"]) {
        const own = await backend.buildApp(config);
        assert.throws(() => own[method]("/api/x", async () => ({})), /GET \+ POST only/, method);
        await own.close().catch(() => {});
    }
});

test("every registered route is GET/HEAD/POST/OPTIONS", async () => {
    const routes = app.printRoutes({ commonPrefix: false, includeHooks: false });
    const methods = new Set([...routes.matchAll(/\((\w+(?:, \w+)*)\)/g)].flatMap((m) => m[1].split(", ")));
    for (const method of methods) assert.ok(["GET", "HEAD", "POST", "OPTIONS"].includes(method), method);
});

test("a cross-site POST is refused; same-origin and Origin-less POSTs pass the guard", async () => {
    const post = (headers) => app.inject({ method: "POST", url: "/api/template-items", headers, payload: { name: "a" } });

    const foreign = await post({ origin: "https://evil.example" });
    assert.equal(foreign.statusCode, 403);
    assert.equal(foreign.json().code, "forbidden_origin");

    assert.equal((await post({ origin: "null" })).statusCode, 403);

    // These reach the route, which answers 503 because the DB is off in unit tests.
    assert.equal((await post({ origin: "http://localhost:80", host: "localhost:80" })).statusCode, 503);
    assert.equal((await post({})).statusCode, 503);
});

test("app.public_origins lets a listed site in (and only it)", async () => {
    const own = await backend.buildApp({ ...config, app: { ...config.app, public_origins: ["https://app.example.com"] } });
    const ok = await own.inject({ method: "POST", url: "/api/template-items", headers: { origin: "https://app.example.com" }, payload: { name: "a" } });
    assert.equal(ok.statusCode, 503);
    const cors = await own.inject({ method: "GET", url: "/api/health", headers: { origin: "https://app.example.com" } });
    assert.equal(cors.headers["access-control-allow-origin"], "https://app.example.com");
    const other = await own.inject({ method: "GET", url: "/api/health", headers: { origin: "https://evil.example" } });
    assert.equal(other.headers["access-control-allow-origin"], undefined);
    await own.close();
});
