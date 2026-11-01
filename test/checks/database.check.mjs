// Live checks WITH a database. Needs test/test.config.json (gitignored — copy
// test.config.example.json): the "database" block of a config, pointing at a
// database your test user may create schemas in. Tests run in their OWN schema
// (<project>_test) and drop it afterwards — never the app's real schema.
import { makeChecker, skip } from "../lib/checker.mjs";
import { testConfig, startServer, stopServer, localTestDatabase, BACKEND } from "../lib/backend.mjs";
import path from "node:path";
import { createRequire } from "node:module";

const database = localTestDatabase();
if (!database) {
    skip("no test/test.config.json — copy test/test.config.example.json and fill in a test database to run DB checks");
    process.exit(0);
}

const { check, done } = makeChecker("database.check — the app against a real database");
const baseSchema = database.connection?.schemas?.project || "app";
const testSchema = baseSchema.endsWith("_test") ? baseSchema : `${baseSchema}_test`;
const config = testConfig({
    logging: { message: { log_to_database: true }, request: { log_to_database: true } },
    database: { ...database, enabled: true, connection: { ...database.connection, schemas: { ...database.connection.schemas, project: testSchema } } },
});

// Talk to the DB directly with the backend's own driver (no extra test dependency).
const pg = createRequire(path.join(BACKEND, "package.json"))("pg");
const conn = config.database.connection;
const db = new pg.Client({ host: conn.host, port: conn.port, user: conn.username, password: conn.password, database: conn.database });

let server;
try {
    await db.connect();
    await db.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);

    server = await startServer(config);
    const health = await (await fetch(`${server.base}/api/health`)).json();
    check("health reports db up", health.data?.db === "up", JSON.stringify(health));

    const post = (url, body) => fetch(`${server.base}${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const created = await post("/api/template-items", { name: "db check item", status: "active" });
    const item = (await created.json()).data;
    check("create -> 201 with a uuid", created.status === 201 && /^[0-9a-f-]{36}$/.test(item?.uuid ?? ""), String(created.status));

    const updated = await post(`/api/template-items/${item.uuid}`, { priority: "high" });
    check("update via POST /:uuid", updated.status === 200 && (await updated.json()).data?.priority === "high");

    const missing = await post("/api/template-items/00000000-0000-4000-8000-000000000000", { name: "x" });
    check("update of an unknown uuid -> 404 not_found", missing.status === 404 && (await missing.json()).code === "not_found");

    const list = await (await fetch(`${server.base}/api/template-items?status=active`)).json();
    check("list filtered by status", list.ok && list.data.some((row) => row.uuid === item.uuid));

    await new Promise((r) => setTimeout(r, 500));
    const logs = await db.query(`SELECT response_status, duration_ms, request_header, created_at FROM "${testSchema}".log_requests ORDER BY rolling_id DESC LIMIT 5`);
    check("log_requests rows have status, duration and created_at", logs.rows.length > 0 && logs.rows.every((r) => r.response_status && r.created_at && r.duration_ms !== null));
    check("log_requests stores no headers by default", logs.rows.every((r) => r.request_header === null));
    const messages = await db.query(`SELECT count(*)::int AS n FROM "${testSchema}".log_messages WHERE created_at IS NOT NULL`);
    check("log_messages rows have created_at", messages.rows[0].n > 0);
} catch (err) {
    check("database checks could run", false, err.message);
} finally {
    await stopServer(server);
    try {
        await db.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
    } catch {
        // connection may have failed — nothing to clean
    }
    await db.end().catch(() => {});
}

done();
