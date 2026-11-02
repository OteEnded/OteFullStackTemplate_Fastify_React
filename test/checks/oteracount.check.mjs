// A REAL "Login with Oteracount" round trip — against a PRIVATE Oteracount started from its
// own source for this run (never the one Ote runs): own port (app.port + 2), own schema
// (oteracount_tmpl_test, dropped after), own throwaway client and account.
//
// Needs test/test.config.json with a "database" block AND
//   "oteracount": { "repo": "C:\\data\\Otenization\\Oteracount" }   (a checkout with node_modules)
// else SKIPPED.
//
// Flow: app /api/auth/oteracount/start → Oteracount /oidc/auth → sign-in → consent → app callback
// → session → /api/auth/me → sign-out → Oteracount end-session → back to the app's /login.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { makeChecker, skip } from "../lib/checker.mjs";
import { testConfig, startServer, stopServer, localTestDatabase, portIsFree, TEST_PORT, BACKEND, ROOT } from "../lib/backend.mjs";
import { HttpBrowser } from "../lib/http-browser.mjs";

const testCfgFile = path.join(ROOT, "test", "test.config.json");
const local = fs.existsSync(testCfgFile) ? JSON.parse(fs.readFileSync(testCfgFile, "utf8").replace(/^\uFEFF/, "")) : {};
const database = localTestDatabase();
const OAC_REPO = local.oteracount?.repo;
if (!database || !OAC_REPO || !fs.existsSync(path.join(OAC_REPO, "Backend", "server.js"))) {
    skip("needs test/test.config.json with a database block and oteracount.repo (an Oteracount checkout) — real Oteracount round trip not run");
    process.exit(0);
}

const { check, done } = makeChecker("oteracount.check — a real Login with Oteracount round trip (private Oteracount)");
const OAC_BACKEND = path.join(OAC_REPO, "Backend");
const OAC_PORT = TEST_PORT + 1; // the template's own block: 8080 app · 8081 test app · 8082 test Oteracount
const OC = `http://127.0.0.1:${OAC_PORT}`;
const APP = `http://127.0.0.1:${TEST_PORT}`;
const OAC_SCHEMA = "oteracount_tmpl_test";
const rnd = (n = 32) => crypto.randomBytes(n).toString("base64url");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fst-test-oac-"));

// --- the private Oteracount's config: its own example + test values ---
const strip = (o) => {
    for (const k of Object.keys(o)) {
        if (k === "_comments") delete o[k];
        else if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) strip(o[k]);
    }
    return o;
};
const oac = strip(JSON.parse(fs.readFileSync(path.join(OAC_BACKEND, "config.example.json"), "utf8")));
const rootPassword = rnd(18);
Object.assign(oac.app, { port: OAC_PORT, host: "127.0.0.1", publicOrigin: OC, trustProxy: false });
Object.assign(oac.auth.root, { enabled: true, username: "root", password: rootPassword });
Object.assign(oac.auth.session, { cookieName: "oac_tmpltest", secret: rnd(), salt: rnd(12).slice(0, 16) });
oac.auth.encryptionSecret = rnd();
oac.oidc.cookieKeys = [rnd()];
oac.registration = { ...oac.registration, enabled: true };
for (const sink of ["message", "request", "sequelize"]) {
    Object.assign(oac.logging[sink], { log_directory: tmp, log_to_console: false, log_to_database: false });
}
oac.database = { ...oac.database, enabled: true, connection: { ...oac.database.connection, ...database.connection, schemas: { parent: "public", project: OAC_SCHEMA } } };
const oacConfigFile = path.join(tmp, "oteracount.config.json");
fs.writeFileSync(oacConfigFile, JSON.stringify(oac, null, 2));

const pg = createRequire(path.join(BACKEND, "package.json"))("pg");
const conn = database.connection;
const db = new pg.Client({ host: conn.host, port: conn.port, user: conn.username, password: conn.password, database: conn.database });

let oacProcess;
let app;
try {
    if (!(await portIsFree(OAC_PORT))) throw new Error(`port ${OAC_PORT} (test Oteracount) is in use`);
    await db.connect();
    await db.query(`DROP SCHEMA IF EXISTS "${OAC_SCHEMA}" CASCADE`);

    // 1. Private Oteracount: migrate, start, wait.
    const migrated = spawnSync(process.execPath, ["database/migrate.js", "up", "--config", oacConfigFile], { cwd: OAC_BACKEND, encoding: "utf8" });
    check("private Oteracount: migrations applied to its own schema", migrated.status === 0, `${migrated.stdout}${migrated.stderr}`.slice(-600));
    oacProcess = spawn(process.execPath, ["server.js", "--config", oacConfigFile], { cwd: OAC_BACKEND, stdio: ["ignore", "pipe", "pipe"] });
    let oacOut = "";
    oacProcess.stdout.on("data", (d) => (oacOut += d));
    oacProcess.stderr.on("data", (d) => (oacOut += d));
    let up = false;
    for (let i = 0; i < 60 && !up && oacProcess.exitCode === null; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
            up = (await fetch(`${OC}/oidc/.well-known/openid-configuration`)).ok;
        } catch {
            up = false;
        }
    }
    if (!up) throw new Error(`private Oteracount did not start:\n${oacOut.slice(-1500)}`);
    check(`private Oteracount is up on ${OC} (OIDC discovery answers)`, true);

    // 2. Register the template app as a client (as root) and create a person to sign in with.
    const admin = new HttpBrowser();
    const rootLogin = await admin.postJson(`${OC}/api/root/login`, { username: "root", password: rootPassword }, { origin: OC });
    check("root signs in to the private Oteracount", rootLogin.status === 200, rootLogin.text);
    const clientId = `tmpl-test-${rnd(4).toLowerCase()}`;
    const made = await admin.postJson(`${OC}/api/admin/clients`, {
        client_id: clientId,
        client_name: "Template round-trip test",
        redirect_uris: [`${APP}/api/auth/oteracount/callback`],
        post_logout_redirect_uris: [`${APP}/login`],
    }, { origin: OC });
    const clientSecret = made.json?.data?.client_secret;
    check("the template app is registered as a client (secret returned once)", made.status === 201 && Boolean(clientSecret), made.text);

    const person = new HttpBrowser();
    const username = `tmpl_${rnd(4).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
    const password = `Pw-${rnd(12)}`;
    const signup = await person.postJson(`${OC}/api/accounts`, { username, email: `${username}@example.test`, password, displayName: "Round Trip" }, { origin: OC });
    const sub = signup.json?.data?.sub;
    check("a test person has an Oteracount", signup.status === 201 && Boolean(sub), signup.text);

    // 3. The template app, configured for this Oteracount (DB off → session-only identity).
    app = await startServer(testConfig({
        auth: {
            enabled: true,
            session: { secret: rnd() },
            root: { enabled: false },
            oteracount: {
                enabled: true,
                issuer: `${OC}/oidc`,
                clientId,
                clientSecret,
                redirectUri: `${APP}/api/auth/oteracount/callback`,
                postLogoutRedirectUri: `${APP}/login`,
                scopes: "openid profile email",
                default_role: "user",
            },
        },
    }));
    const me = async () => (await person.request(`${APP}/api/auth/me`)).json?.data;
    const methods = (await me())?.methods;
    check("the app offers Login with Oteracount", methods?.oteracount === true, JSON.stringify(methods));

    // 4. The round trip, answering Oteracount's sign-in and consent like a person would.
    const isInteraction = (u) => u.origin === OC && /^\/interaction\/[^/]+$/.test(u.pathname);
    const backAtApp = (u) => u.origin === APP && u.pathname === "/console";
    let at = await person.go(`${APP}/api/auth/oteracount/start`, { stopAt: (u) => isInteraction(u) || backAtApp(u) });
    const authHop = person.trail.find((t) => t.includes(`${OC}/oidc/auth`));
    check("start redirects to Oteracount's authorize endpoint with PKCE S256", Boolean(authHop) && authHop.includes("code_challenge_method=S256"), authHop);
    const prompts = [];
    for (let i = 0; i < 5 && at.stoppedAt && isInteraction(new URL(at.stoppedAt)); i++) {
        const uid = new URL(at.stoppedAt).pathname.split("/")[2];
        const details = (await person.request(`${OC}/interaction/${uid}/details`)).json?.data;
        prompts.push(details?.prompt);
        // The template asks for prompt=select_account (the guide's advice): with no Oteracount session
        // yet, the chooser's answer is "sign in below" — so login answers both login and select_account.
        const step = details?.prompt === "login" || details?.prompt === "select_account"
            ? await person.postJson(`${OC}/interaction/${uid}/login`, { identifier: username, password }, { origin: OC })
            : await person.postJson(`${OC}/interaction/${uid}/consent`, {}, { origin: OC });
        if (step.status !== 200) throw new Error(`interaction ${details?.prompt} failed: ${step.status} ${step.text}`);
        at = await person.go(step.json.data.redirectTo, { stopAt: (u) => isInteraction(u) || backAtApp(u) });
    }
    check("Oteracount asked the person to choose / sign in (then consent)", prompts.some((p) => p === "login" || p === "select_account"), prompts.join(" → "));
    check("the callback signs the person in and lands on /console", at.stoppedAt?.startsWith(`${APP}/console`) === true, at.stoppedAt ?? `${at.status} ${at.url}`);

    const user = (await me())?.user;
    check("/api/auth/me: an Oteracount user with the person's name and the default role",
        user?.kind === "oteracount" && user?.name === "Round Trip" && user?.role === "user", JSON.stringify(user));
    // Cookies are host-scoped, not port-scoped: the app's `<slug>_session` and Oteracount's OIDC
    // `_session` share one jar on 127.0.0.1 — they must have different names (they do).
    const names = [...person.jar.values()].filter((c) => c.path === "/").map((c) => c.name);
    check("the app's session cookie and Oteracount's OIDC session coexist on one host (different names)",
        names.includes(`${testConfig().app.slug}_session`) && names.includes("_session"), names.join(", "));

    // 5. Sign out: app session ends, then Oteracount's end-session brings the person back to /login.
    const out = await person.request(`${APP}/api/auth/logout`, { method: "POST", headers: { origin: APP } });
    const redirect = out.json?.data?.redirect;
    check("sign-out returns Oteracount's end-session URL (with id_token_hint)", typeof redirect === "string" && redirect.startsWith(`${OC}/oidc/session/end`) && redirect.includes("id_token_hint"), redirect);
    check("the app session is gone after sign-out", (await me())?.user === null);
    const confirm = await person.go(redirect);
    const action = /<form id="op\.logoutForm" method="post" action="([^"]+)"/.exec(confirm.text ?? "")?.[1];
    const xsrf = /name="xsrf" value="([^"]+)"/.exec(confirm.text ?? "")?.[1];
    let landed = confirm.url?.href;
    if (action && xsrf) {
        const posted = await person.postForm(new URL(action, confirm.url).href, { xsrf, logout: "yes" });
        landed = posted.location ?? landed;
    }
    check("Oteracount's end-session returns to the app's /login", String(landed).startsWith(`${APP}/login`), String(landed));

    // 6. A forged callback (state mismatch) is refused, not signed in.
    const forger = new HttpBrowser();
    await forger.go(`${APP}/api/auth/oteracount/start`, { stopAt: (u) => u.origin === OC });
    const forged = await forger.request(`${APP}/api/auth/oteracount/callback?code=fake&state=wrong&iss=${encodeURIComponent(`${OC}/oidc`)}`);
    check("a forged callback is refused (redirect to /login?error=…)", forged.status === 302 && /\/login\?error=oteracount/.test(forged.location ?? ""), `${forged.status} ${forged.location}`);
} catch (err) {
    check("the round trip could run", false, err.stack || err.message);
} finally {
    await stopServer(app);
    if (oacProcess && oacProcess.exitCode === null) {
        const exited = new Promise((r) => oacProcess.once("exit", r));
        oacProcess.kill();
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    }
    try {
        await db.query(`DROP SCHEMA IF EXISTS "${OAC_SCHEMA}" CASCADE`);
    } catch {
        // connection may have failed
    }
    await db.end().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
}

done();
