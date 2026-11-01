// Live checks WITH a database (Postgres, schema_mode "migrate"). Needs test/test.config.json
// (gitignored — copy test.config.example.json): the "database" block of a config, pointing at
// a database your (non-superuser) test account may create schemas in. Everything runs in its
// OWN schema (<project>_test) and that schema is dropped afterwards — never the real one.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { makeChecker, skip } from "../lib/checker.mjs";
import { testConfig, writeConfig, startServer, stopServer, runServer, localTestDatabase, BACKEND } from "../lib/backend.mjs";

const database = localTestDatabase();
if (!database) {
    skip("no test/test.config.json — copy test/test.config.example.json and fill in a test database to run DB checks");
    process.exit(0);
}

const { check, done } = makeChecker("database.check — migrations, schema guard and the app against Postgres");
const baseSchema = database.connection?.schemas?.project || "app";
const schema = baseSchema.endsWith("_test") ? baseSchema : `${baseSchema}_test`;
const config = testConfig({
    logging: { message: { log_to_database: true }, request: { log_to_database: true }, retention_days: 30 },
    database: { ...database, enabled: true, schema_mode: "migrate", connection: { ...database.connection, schemas: { ...database.connection.schemas, project: schema } } },
});
const configFile = writeConfig(config);

const pg = createRequire(path.join(BACKEND, "package.json"))("pg");
const conn = config.database.connection;
const db = new pg.Client({ host: conn.host, port: conn.port, user: conn.username, password: conn.password, database: conn.database });
const q = async (sql, params) => (await db.query(sql, params)).rows;

const node = (script, ...args) => {
    const r = spawnSync(process.execPath, [script, "--config", configFile, ...args], { cwd: BACKEND, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
async function bootRefused() {
    const child = runServer(configFile);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const code = await new Promise((resolve) => {
        const timer = setTimeout(() => { child.kill(); resolve("timeout"); }, 15000);
        child.on("exit", (c) => { clearTimeout(timer); resolve(c); });
    });
    return { code, out };
}

let server;
try {
    await db.connect();
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);

    // 1. Never migrated -> the server refuses to start and says what to run.
    let boot = await bootRefused();
    check("boot on an unmigrated schema is refused (exit 1, says db:migrate)", boot.code === 1 && /db:migrate/.test(boot.out), `code ${boot.code}`);

    // 2. Migrate, then migrate again.
    let run = node("database/migrate.js");
    check("db:migrate applies every migration (exit 0)", run.code === 0 && /2 migration\(s\) applied/.test(run.out), run.out.trim());
    run = node("database/migrate.js");
    check("db:migrate a second time applies nothing", run.code === 0 && /nothing to apply/.test(run.out), run.out.trim());
    run = node("database/migrate.js", "--status");
    check("db:status lists both files as applied", (run.out.match(/applied /g) || []).length === 2, run.out.trim());

    // 3. CHECK constraints mirror CHOICES (one list for model, schema and database).
    const { CHOICES } = await import(pathToFileURL(path.join(BACKEND, "database", "models", "index.js")).href);
    const checks = await q(
        `SELECT conname::text AS name, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
           JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = $1 AND c.contype = 'c'`, [schema]);
    for (const [key, values] of Object.entries(CHOICES)) {
        const def = checks.find((c) => c.name === `${key}_check`)?.def ?? "";
        check(`CHECK ${key}_check matches CHOICES.${key}`, values.every((v) => def.includes(`'${v}'`)) && (def.match(/'[^']+'/g) || []).length === values.length, def || "constraint missing");
    }

    // 4. An old log row, so retention has something to prune at startup.
    await q(`INSERT INTO "${schema}".log_messages (server_start_on, report_on, report_by, messages, created_at)
             VALUES (now(), now(), 'database.check', 'old row', now() - interval '60 days')`);

    // 5. The app.
    server = await startServer(config);
    const health = await (await fetch(`${server.base}/api/health`)).json();
    check("health reports db up", health.data?.db === "up", JSON.stringify(health));

    const post = (url, body) => fetch(`${server.base}${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const created = await post("/api/template-items", { name: "db check item", status: "active" });
    const item = (await created.json()).data;
    check("create -> 201 with a uuid and a rolling_id", created.status === 201 && /^[0-9a-f-]{36}$/.test(item?.uuid ?? "") && Number.isInteger(item?.rolling_id), JSON.stringify(item));
    const updated = await post(`/api/template-items/${item.uuid}`, { priority: "high" });
    check("update via POST /:uuid", updated.status === 200 && (await updated.json()).data?.priority === "high");
    const missing = await post("/api/template-items/00000000-0000-4000-8000-000000000000", { name: "x" });
    check("update of an unknown uuid -> 404 not_found", missing.status === 404 && (await missing.json()).code === "not_found");
    const list = await (await fetch(`${server.base}/api/template-items?status=active`)).json();
    check("list filtered by status", list.ok && list.data.some((row) => row.uuid === item.uuid));

    await new Promise((r) => setTimeout(r, 600));
    const logs = await q(`SELECT response_status, duration_ms, request_header, created_at FROM "${schema}".log_requests ORDER BY rolling_id DESC LIMIT 5`);
    check("log_requests rows have status, duration and created_at", logs.length > 0 && logs.every((r) => r.response_status && r.created_at && r.duration_ms !== null));
    check("log_requests stores no headers by default", logs.every((r) => r.request_header === null));
    const old = await q(`SELECT count(*)::int AS n FROM "${schema}".log_messages WHERE messages = 'old row'`);
    check("retention removed the 60-day-old log row at startup (retention_days 30)", old[0].n === 0);
    await stopServer(server);
    server = null;

    // 6. Seeds are a script, not a boot step.
    run = node("database/seed.js");
    const seeded = await q(`SELECT count(*)::int AS n FROM "${schema}".mst_template_items`);
    check("db:seed adds the demo rows", run.code === 0 && seeded[0].n >= 4, `${run.out.trim()} rows=${seeded[0].n}`);
    run = node("database/seed.js", "--reset");
    const reset = await q(`SELECT count(*)::int AS n FROM "${schema}".mst_template_items`);
    check("db:reset-demo leaves exactly the seed rows", run.code === 0 && reset[0].n === 3, `rows=${reset[0].n}`);

    // 7. The guard's refusals.
    await q(`UPDATE "${schema}".log_migrations SET checksum = repeat('0', 64) WHERE filename LIKE '002%'`);
    run = node("database/migrate.js");
    check("an edited applied migration is refused by db:migrate", run.code === 1 && /changed since they ran/.test(run.out), run.out.trim());
    boot = await bootRefused();
    check("... and by the server at boot", boot.code === 1 && /edited afterwards/.test(boot.out), `code ${boot.code}`);
    await q(`DELETE FROM "${schema}".log_migrations WHERE filename LIKE '002%'`);
    boot = await bootRefused();
    check("a pending migration refuses boot", boot.code === 1 && /pending migration/.test(boot.out), `code ${boot.code}`);
    run = node("database/migrate.js", "--baseline", "002");
    check("--baseline is refused once a record exists", run.code === 1 && /only for a database with no record/.test(run.out));
    // Re-record 002 as applied (its table still exists) to get back to a clean state.
    const { readMigrationFiles } = await import(pathToFileURL(path.join(BACKEND, "database", "migration-files.js")).href);
    const f002 = readMigrationFiles().find((f) => f.filename.startsWith("002"));
    await q(`INSERT INTO "${schema}".log_migrations (filename, checksum, applied_by) VALUES ($1, $2, current_user)`, [f002.filename, f002.checksum]);
    await q(`ALTER TABLE "${schema}".mst_template_items RENAME TO mst_template_items_moved`);
    boot = await bootRefused();
    check("a model whose table is missing refuses boot", boot.code === 1 && /model\(s\) without a table: mst_template_items/.test(boot.out), `code ${boot.code}`);
    await q(`ALTER TABLE "${schema}".mst_template_items_moved RENAME TO mst_template_items`);
} catch (err) {
    check("database checks could run", false, err.stack || err.message);
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
