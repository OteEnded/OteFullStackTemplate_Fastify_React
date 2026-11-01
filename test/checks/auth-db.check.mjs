// The auth module with LOCAL USERS on a real database (Postgres, migrate mode), managed
// through the CLI (npm run auth:user). Needs test/test.config.json — else SKIPPED.
// Runs in its own <project>_test schema, dropped afterwards.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { makeChecker, skip } from "../lib/checker.mjs";
import { testConfig, writeConfig, startServer, stopServer, localTestDatabase, BACKEND } from "../lib/backend.mjs";

const database = localTestDatabase();
if (!database) {
    skip("no test/test.config.json — local-user auth needs a test database");
    process.exit(0);
}

const { check, done } = makeChecker("auth-db.check — local users, roles and disabling, against Postgres");
const requireBackend = createRequire(path.join(BACKEND, "package.json"));
const bcrypt = requireBackend("bcryptjs");
const schema = `${database.connection?.schemas?.project || "app"}_test`.replace(/_test_test$/, "_test");
const config = testConfig({
    database: { ...database, enabled: true, schema_mode: "migrate", connection: { ...database.connection, schemas: { ...database.connection.schemas, project: schema } } },
    auth: {
        enabled: true,
        session: { secret: "y".repeat(40) },
        root: { enabled: true, username: "root", password_hash: bcrypt.hashSync("root-pw-123", 4) },
        local_users: { enabled: true },
        roles: { admin: ["*"], editor: ["items.write"], user: [] },
    },
});
const configFile = writeConfig(config);
const COOKIE = `${config.app.slug}_session`;

const pg = requireBackend("pg");
const conn = config.database.connection;
const db = new pg.Client({ host: conn.host, port: conn.port, user: conn.username, password: conn.password, database: conn.database });
const cli = (...args) => {
    const r = spawnSync(process.execPath, ["app/modules/auth/cli.js", ...args, "--config", configFile], { cwd: BACKEND, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

let server;
try {
    await db.connect();
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    const migrated = spawnSync(process.execPath, ["database/migrate.js", "--config", configFile], { cwd: BACKEND, encoding: "utf8" });
    check("migrations applied (incl. 003_auth_users)", migrated.status === 0 && /003_auth_users/.test(migrated.stdout), migrated.stdout + migrated.stderr);

    let r = cli("add", "alice", "alice-pw-123", "user");
    check("auth:user add alice (user)", r.code === 0, r.out.trim());
    r = cli("add", "bob", "bob-pw-123", "editor");
    check("auth:user add bob (editor)", r.code === 0, r.out.trim());
    r = cli("add", "carol", "pw", "superhero");
    check("unknown role refused", r.code === 1 && /unknown role/.test(r.out), r.out.trim());
    r = cli("list");
    check("auth:user list shows both", /alice/.test(r.out) && /bob/.test(r.out), r.out.trim());
    const stored = await db.query(`SELECT password_hash FROM "${schema}".mst_users WHERE username = 'alice'`);
    check("passwords are stored as bcrypt hashes", /^\$2[aby]\$/.test(stored.rows[0]?.password_hash ?? ""));

    server = await startServer(config);
    const post = (url, body, cookie) => fetch(`${server.base}${url}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(cookie ? { cookie: `${COOKIE}=${cookie}` } : {}) },
        body: JSON.stringify(body),
    });
    const sessionOf = (res) => /(?:^|,\s*)[^=]+_session=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1];
    const me = async (cookie) => (await (await fetch(`${server.base}/api/auth/me`, { headers: { cookie: `${COOKIE}=${cookie}` } })).json()).data.user;

    const alice = sessionOf(await post("/api/auth/login", { username: "Alice", password: "alice-pw-123" }));
    check("a local user signs in (username is case-insensitive)", Boolean(alice) && (await me(alice))?.kind === "local");
    const bob = sessionOf(await post("/api/auth/login", { username: "bob", password: "bob-pw-123" }));

    check("a 'user' can read the demo list", (await fetch(`${server.base}/api/template-items`, { headers: { cookie: `${COOKIE}=${alice}` } })).status === 200);
    const denied = await post("/api/template-items", { name: "x" }, alice);
    check("a 'user' may NOT write (403 forbidden)", denied.status === 403 && (await denied.json()).code === "forbidden");
    check("an 'editor' (items.write) may write", (await post("/api/template-items", { name: "from bob" }, bob)).status === 201);

    r = cli("disable", "alice");
    check("auth:user disable alice", r.code === 0, r.out.trim());
    check("her OPEN session stops working at once (account re-read every request)", (await me(alice)) === null);
    check("and she can't sign in again", (await post("/api/auth/login", { username: "alice", password: "alice-pw-123" })).status === 401);

    r = cli("set-role", "bob", "user");
    const bobNow = await me(bob);
    check("a role change applies to the open session", bobNow?.role === "user" && (await post("/api/template-items", { name: "y" }, bob)).status === 403);

    const root = sessionOf(await post("/api/auth/login", { username: "root", password: "root-pw-123" }));
    check("the config root still works alongside local users", (await me(root))?.kind === "root");
} catch (err) {
    check("auth-db checks could run", false, err.stack || err.message);
} finally {
    await stopServer(server);
    try {
        await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } catch {
        // connection may have failed — nothing to clean
    }
    await db.end().catch(() => {});
}

done();
