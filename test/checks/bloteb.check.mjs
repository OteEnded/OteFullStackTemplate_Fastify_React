// The files module with driver "bloteb" — against a PRIVATE Bloteb started from its own source
// for this run (never the one Ote runs): own port (app.port + 3), own schema (bloteb_tmpl_test,
// dropped after), storage in a temp folder, a throwaway app registration.
//
// Needs test/test.config.json with a "database" block AND
//   "bloteb": { "repo": "C:/data/Otenization/Bloteb" }   (a checkout with node_modules)
// else SKIPPED.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { makeChecker, skip } from "../lib/checker.mjs";
import { testConfig, startServer, stopServer, localTestDatabase, portIsFree, TEST_PORT, BACKEND, ROOT } from "../lib/backend.mjs";

const testCfgFile = path.join(ROOT, "test", "test.config.json");
const local = fs.existsSync(testCfgFile) ? JSON.parse(fs.readFileSync(testCfgFile, "utf8").replace(/^\uFEFF/, "")) : {};
const database = localTestDatabase();
const REPO = local.bloteb?.repo;
if (!database || !REPO || !fs.existsSync(path.join(REPO, "Backend", "server.js"))) {
    skip("needs test/test.config.json with a database block and bloteb.repo (a Bloteb checkout) — the bloteb files driver not run live");
    process.exit(0);
}

const { check, done } = makeChecker("bloteb.check — the files module on a private Bloteb");
const BL_BACKEND = path.join(REPO, "Backend");
const PORT = TEST_PORT + 2; // 8080 app · 8081 test app · 8082 test Oteracount · 8083 test Bloteb
const BL = `http://127.0.0.1:${PORT}`;
const SCHEMA = "bloteb_tmpl_test";
const rnd = (n = 32) => crypto.randomBytes(n).toString("base64url");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fst-test-bloteb-"));
fs.mkdirSync(path.join(tmp, "storage"));

const strip = (o) => {
    for (const k of Object.keys(o)) {
        if (k === "_comments") delete o[k];
        else if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) strip(o[k]);
    }
    return o;
};
const bl = strip(JSON.parse(fs.readFileSync(path.join(BL_BACKEND, "config.example.json"), "utf8")));
const rootPassword = rnd(18);
Object.assign(bl.app, { port: PORT, host: "127.0.0.1", publicOrigin: BL, adminOrigin: BL, publicAliases: [], internalOrigins: [] });
Object.assign(bl.storage, { root: path.join(tmp, "storage"), tmp: null, requireMarker: false, credentials: null });
Object.assign(bl.auth.root, { enabled: true, username: "root", password: rootPassword });
Object.assign(bl.auth.session, { cookieName: "bloteb_tmpltest", secret: rnd(), salt: rnd(12).slice(0, 16) });
bl.auth.keyEncryptionSecret = rnd();
bl.oteracount = { ...bl.oteracount, enabled: false };
bl.cron = { ...bl.cron, enabled: false };
delete bl.osm;
for (const sink of ["message", "request", "sequelize"]) {
    if (bl.logging?.[sink]) Object.assign(bl.logging[sink], { log_directory: tmp, log_to_console: false, log_to_database: false });
}
bl.database = { ...bl.database, enabled: true, connection: { ...bl.database.connection, ...database.connection, schemas: { parent: "public", project: SCHEMA } } };
const blConfigFile = path.join(tmp, "bloteb.config.json");
fs.writeFileSync(blConfigFile, JSON.stringify(bl, null, 2));
const blEnv = { ...process.env, BLOTEB_CONFIG: blConfigFile }; // Bloteb's own switch for a private instance

const pg = createRequire(path.join(BACKEND, "package.json"))("pg");
const conn = database.connection;
const db = new pg.Client({ host: conn.host, port: conn.port, user: conn.username, password: conn.password, database: conn.database });
// A real (valid) 1×1 PNG — Bloteb checks the structure, not just the signature.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let blProcess;
let app;
try {
    if (!(await portIsFree(PORT))) throw new Error(`port ${PORT} (test Bloteb) is in use`);
    await db.connect();
    await db.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);

    const migrated = spawnSync(process.execPath, ["database/migrate.js", "up"], { cwd: BL_BACKEND, encoding: "utf8", env: blEnv });
    check("private Bloteb: migrations applied to its own schema", migrated.status === 0, `${migrated.stdout}${migrated.stderr}`.slice(-600));
    blProcess = spawn(process.execPath, ["server.js"], { cwd: BL_BACKEND, env: blEnv, stdio: ["ignore", "pipe", "pipe"] });
    let blOut = "";
    blProcess.stdout.on("data", (d) => (blOut += d));
    blProcess.stderr.on("data", (d) => (blOut += d));
    let up = false;
    for (let i = 0; i < 60 && !up && blProcess.exitCode === null; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
            up = (await fetch(`${BL}/api/health`)).status < 500;
        } catch {
            up = false;
        }
    }
    if (!up) throw new Error(`private Bloteb did not start:\n${blOut.slice(-1500)}`);
    check(`private Bloteb is up on ${BL}`, true);

    // Register this app (as root) — the private key comes back once.
    const login = await fetch(`${BL}/auth/root`, { method: "POST", redirect: "manual", headers: { "content-type": "application/json", origin: BL }, body: JSON.stringify({ username: "root", password: rootPassword }) });
    const cookie = (login.headers.getSetCookie() ?? []).map((c) => c.split(";")[0]).join("; ");
    check("root signs in to the private Bloteb", login.status < 400 && cookie.includes("bloteb_tmpltest"), `${login.status}`);
    const slug = `tmpl-${rnd(4).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
    const made = await fetch(`${BL}/api/admin/apps`, { method: "POST", headers: { "content-type": "application/json", origin: BL, cookie }, body: JSON.stringify({ slug, name: "Template files test", allowedTypes: ["image/*", "text/plain"], maxFileBytes: 1048576, quotaBytes: 10485760 }) });
    const madeJson = await made.json();
    const key = madeJson?.data?.privateKey;
    check("the template app is registered in Bloteb (bk1 key returned once)", made.status === 201 && String(key).startsWith("bk1."), JSON.stringify(madeJson).slice(0, 200));

    // The template on driver "bloteb" (auth on, so ownership is real).
    const bcrypt = createRequire(path.join(BACKEND, "package.json"))("bcryptjs");
    const appConfig = testConfig({
        auth: { enabled: true, session: { secret: rnd() }, root: { enabled: true, username: "root", password_hash: bcrypt.hashSync("root-pw-123", 4) }, local_users: { enabled: false } },
        files: { enabled: true, driver: "bloteb", max_mb: 1, types: ["image/*", "text/plain"], bloteb: { baseUrl: BL, internalBaseUrl: "", app: slug, key } },
    });
    app = await startServer(appConfig);
    const signIn = await fetch(`${app.base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "root", password: "root-pw-123" }) });
    const session = (signIn.headers.getSetCookie() ?? []).map((c) => c.split(";")[0]).join("; ");

    const form = new FormData();
    form.append("file", new Blob([PNG], { type: "text/html" }), "photo.png");
    const up1 = await fetch(`${app.base}/api/files`, { method: "POST", headers: { cookie: session }, body: form });
    const up1Body = await up1.json();
    const file = up1Body.data;
    if (up1.status !== 201) {
        // The app hides 5xx detail from clients by design — show it from the test instance's own log.
        const logDir = appConfig.logging.message.log_directory;
        const errors = fs.readdirSync(logDir)
            .filter((n) => n.startsWith("message_"))
            .flatMap((n) => fs.readFileSync(path.join(logDir, n), "utf8").split(/\r?\n/))
            .filter((l) => /ERROR/.test(l));
        console.log(`    upload answered ${up1.status} ${JSON.stringify(up1Body)}`);
        for (const line of errors.slice(-3)) console.log(`    app log: ${line}`);
    }
    check("upload through the template → 201, a Bloteb blob id, the REAL type (Bloteb's detection)", up1.status === 201 && file?.mime === "image/png" && file?.size === PNG.length, JSON.stringify(file));
    check("the link points at Bloteb with a signed ticket (no bytes through the app)", typeof file?.url === "string" && file.url.startsWith(`${BL}/f/${file.id}`) && file.url.includes("?t="), file?.url);

    const served = await fetch(file.url);
    check("Bloteb serves the exact bytes to that link", served.status === 200 && Buffer.from(await served.arrayBuffer()).equals(PNG), `${served.status}`);
    const blob = await db.query(`SELECT state, owner_sub FROM "${SCHEMA}".mst_blobs WHERE id = $1`, [file.id]);
    check("in Bloteb the blob was claimed (active) and carries the uploader as owner",
        blob.rows[0]?.state === "active" && blob.rows[0]?.owner_sub === "root", JSON.stringify(blob.rows[0] ?? null));

    const noSession = await fetch(`${app.base}/api/files/${file.id}`);
    check("without a session the app refuses the file's metadata (401)", noSession.status === 401);
    const exe = new FormData();
    exe.append("file", new Blob([Buffer.concat([Buffer.from("MZ"), crypto.randomBytes(200)])]), "tool.png");
    const refused = await fetch(`${app.base}/api/files`, { method: "POST", headers: { cookie: session }, body: exe });
    check("a type Bloteb refuses comes back as 415 unsupported_media_type (not a 500)", refused.status === 415 && (await refused.json()).code === "unsupported_media_type", `${refused.status}`);

    const meta = await (await fetch(`${app.base}/api/files/${file.id}`, { headers: { cookie: session } })).json();
    check("with the session: metadata + a fresh signed link", meta.data?.id === file.id && meta.data?.url?.includes("?t="));

    const del = await fetch(`${app.base}/api/files/${file.id}/delete`, { method: "POST", headers: { cookie: session } });
    check("delete through the template (POST /api/files/:id/delete)", (await del.json()).data?.deleted === true);
    const after = await fetch(file.url);
    check("after delete, Bloteb no longer serves it", after.status === 404, `${after.status}`);
} catch (err) {
    check("the Bloteb checks could run", false, err.stack || err.message);
} finally {
    await stopServer(app);
    if (blProcess && blProcess.exitCode === null) {
        const exited = new Promise((r) => blProcess.once("exit", r));
        blProcess.kill();
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    }
    try {
        await db.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    } catch {
        // connection may have failed
    }
    await db.end().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
}

done();
