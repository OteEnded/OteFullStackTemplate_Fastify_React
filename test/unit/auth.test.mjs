// The optional auth module, in-process with the database OFF (config root account only).
// Local users + Oteracount accounts are covered live in checks/auth-db.check.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { testConfig, loadBackend, BACKEND } from "../lib/backend.mjs";

const backendImport = (rel) => import(pathToFileURL(path.join(BACKEND, rel)).href);
const bcrypt = createRequire(path.join(BACKEND, "package.json"))("bcryptjs");

const SECRET = "x".repeat(40);
const config = testConfig({
    auth: {
        enabled: true,
        session: { secret: SECRET },
        root: { enabled: true, username: "root", password_hash: bcrypt.hashSync("correct horse", 4) },
        rate_limit: { max_failures: 3, window_minutes: 15 },
    },
});
const COOKIE = `${config.app.slug}_session`;
let backend;
let app;

before(async () => {
    backend = await loadBackend(config);
    app = await backend.buildApp(config);
    app.get("/api/test-admin-only", { onRequest: app.requirePermission("admin.thing") }, async (request) => ({ ok: true, data: request.user.username }));
});
after(async () => app?.close());

// (trust_proxy is off, so every injected request comes from 127.0.0.1 — one rate-limit bucket.)
const login = (username, password, target = app) => target.inject({ method: "POST", url: "/api/auth/login", payload: { username, password } });
const cookieFrom = (res) => res.cookies.find((c) => c.name === COOKIE);

test("auth OFF (the default): /api/auth/me says so, guarded routes are open", async () => {
    const plain = testConfig();
    const off = await backend.buildApp(plain);
    const me = (await off.inject({ method: "GET", url: "/api/auth/me" })).json();
    assert.deepEqual([me.ok, me.data.enabled, me.data.user], [true, false, null]);
    // the demo list route uses requireSignedIn — a no-op while auth is off (503 = DB off, not 401)
    assert.notEqual((await off.inject({ method: "GET", url: "/api/template-items" })).statusCode, 401);
    await off.close();
});

test("wrong password -> 401 invalid_credentials, no cookie", async () => {
    const res = await login("root", "nope");
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().code, "invalid_credentials");
    assert.equal(cookieFrom(res), undefined);
});

test("right password -> session cookie: per-app name, HttpOnly, SameSite=Lax; /me returns the root user", async () => {
    const res = await login("root", "correct horse");
    assert.equal(res.statusCode, 200);
    const cookie = cookieFrom(res);
    assert.ok(cookie, `expected a ${COOKIE} cookie`);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, "Lax");
    assert.doesNotMatch(cookie.value, /root/); // sealed, not readable

    const me = (await app.inject({ method: "GET", url: "/api/auth/me", cookies: { [COOKIE]: cookie.value } })).json();
    assert.equal(me.data.user.kind, "root");
    assert.deepEqual(me.data.user.permissions, ["*"]);
});

test("guarded routes: 401 without a session, through with one; root passes any permission", async () => {
    assert.equal((await app.inject({ method: "GET", url: "/api/template-items" })).statusCode, 401);
    const cookie = cookieFrom(await login("root", "correct horse")).value;
    assert.equal((await app.inject({ method: "GET", url: "/api/template-items", cookies: { [COOKIE]: cookie } })).statusCode, 503); // past auth; DB off
    const admin = await app.inject({ method: "GET", url: "/api/test-admin-only", cookies: { [COOKIE]: cookie } });
    assert.deepEqual([admin.statusCode, admin.json().data], [200, "root"]);
});

test("a tampered or expired cookie is no session", async () => {
    const cookie = cookieFrom(await login("root", "correct horse")).value;
    const [v, iv, body, tag] = cookie.split(".");
    const bytes = Buffer.from(body, "base64url");
    bytes[0] ^= 0xff; // flip a real ciphertext byte
    const tampered = [v, iv, bytes.toString("base64url"), tag].join(".");
    const me1 = (await app.inject({ method: "GET", url: "/api/auth/me", cookies: { [COOKIE]: tampered } })).json();
    assert.equal(me1.data.user, null);

    const { makeBox } = await backendImport("lib/crypto-box.js");
    const expired = makeBox(SECRET, "session").seal({ kind: "root", exp: Date.now() - 1000 });
    const me2 = (await app.inject({ method: "GET", url: "/api/auth/me", cookies: { [COOKIE]: expired } })).json();
    assert.equal(me2.data.user, null);
});

test("failed sign-ins are rate-limited (429 + Retry-After), even for the right password while locked", async () => {
    const { resetAllLimits } = await backendImport("app/modules/auth/rate-limit.js");
    resetAllLimits(); // start from a clean slate: earlier tests failed once on this bucket
    for (let i = 0; i < 3; i++) assert.equal((await login("root", `bad${i}`)).statusCode, 401, `attempt ${i + 1}`);
    const locked = await login("root", "correct horse");
    assert.equal(locked.statusCode, 429);
    assert.equal(locked.json().code, "too_many_attempts");
    assert.ok(Number(locked.headers["retry-after"]) > 0);
});

test("logout clears the cookie", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/logout" });
    assert.equal(res.statusCode, 200);
    const cleared = cookieFrom(res);
    assert.ok(cleared && (cleared.maxAge === 0 || new Date(cleared.expires) < new Date()));
});

test("Oteracount: the authorize URL uses code + PKCE S256 + state + nonce + the registered redirect", async () => {
    const oidc = await import(pathToFileURL(createRequire(path.join(BACKEND, "package.json")).resolve("openid-client")).href);
    const { startLogin } = await backendImport("app/modules/auth/oteracount.js");
    const oacConfig = { auth: { oteracount: { enabled: true, issuer: "https://oac.example", clientId: "app1", clientSecret: "s", redirectUri: "https://app.example/api/auth/oteracount/callback" } } };
    const server = new oidc.Configuration({ issuer: "https://oac.example", authorization_endpoint: "https://oac.example/authorize" }, "app1", "s");
    const { url, flow } = await startLogin(oacConfig, server);
    const q = url.searchParams;
    assert.equal(url.origin + url.pathname, "https://oac.example/authorize");
    assert.equal(q.get("response_type"), "code");
    assert.equal(q.get("code_challenge_method"), "S256");
    assert.equal(q.get("redirect_uri"), oacConfig.auth.oteracount.redirectUri);
    assert.equal(q.get("state"), flow.state);
    assert.equal(q.get("nonce"), flow.nonce);
    assert.ok(flow.verifier && q.get("code_challenge") && q.get("code_challenge") !== flow.verifier);
});

test("crypto-box: round-trips, rejects tampering and a key for another purpose, refuses a short secret", async () => {
    const { makeBox } = await backendImport("lib/crypto-box.js");
    const box = makeBox(SECRET, "a");
    const token = box.seal({ apiKey: "k-123" });
    assert.deepEqual(box.open(token), { apiKey: "k-123" });
    // Flip a real BYTE of the ciphertext (editing the last base64url char can touch only padding
    // bits that decode to the same bytes — a flaky "tamper" that sometimes changes nothing).
    const [v, iv, body, tag] = token.split(".");
    const bytes = Buffer.from(body, "base64url");
    bytes[0] ^= 0xff;
    assert.equal(box.open([v, iv, bytes.toString("base64url"), tag].join(".")), null);
    assert.equal(makeBox(SECRET, "b").open(token), null);
    assert.throws(() => makeBox("short"), /at least 32/);
});

test("config check: auth rules apply only when auth is on", () => {
    const { checkConfig } = backend;
    assert.deepEqual(checkConfig(testConfig()), [], "shipped defaults (auth off, CHANGE_ME secrets) must pass");
    const bad = checkConfig(testConfig({ auth: { enabled: true, session: { secret: "short" }, root: { password_hash: "" }, local_users: { enabled: true }, oteracount: { enabled: true, clientSecret: "x" } } }));
    for (const pattern of [/session\.secret/, /password_hash is not a bcrypt/, /local_users needs the database/, /oteracount\.issuer is empty/]) {
        assert.ok(bad.some((p) => pattern.test(p)), `missing ${pattern}: ${bad.join(" | ")}`);
    }
});
