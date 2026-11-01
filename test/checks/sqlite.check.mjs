// The app on a local SQLite file in schema_mode "sync". Runs only when the SQLite
// driver is installed in Backend (`npm install sqlite3` — a native module, so a SQLite
// project can't become a portable EXE); otherwise SKIPPED.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { makeChecker, skip } from "../lib/checker.mjs";
import { testConfig, startServer, stopServer, BACKEND } from "../lib/backend.mjs";

try {
    createRequire(path.join(BACKEND, "package.json")).resolve("sqlite3");
} catch {
    skip("sqlite3 is not installed in Backend (npm install sqlite3) — SQLite mode not checked");
    process.exit(0);
}

const { check, done } = makeChecker("sqlite.check — the app on a SQLite file, schema_mode sync");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fst-test-sqlite-"));
const storage = path.join(dir, "app.sqlite");
const config = testConfig({
    logging: { message: { log_to_database: true }, request: { log_to_database: true } },
    database: { enabled: true, schema_mode: "sync", connection: { dialect: "sqlite", storage } },
});

let server;
try {
    server = await startServer(config);
    const health = await (await fetch(`${server.base}/api/health`)).json();
    check("starts on SQLite and health reports db up", health.data?.db === "up", JSON.stringify(health));
    check("sync created the database file", fs.existsSync(storage));

    // CRUD through the demo feature — only while it exists (the wizard can remove it).
    if (fs.existsSync(path.join(BACKEND, "app", "routes", "api", "template-item.route.js"))) {
    const post = (url, body) => fetch(`${server.base}${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const created = await post("/api/template-items", { name: "sqlite item" });
    const item = (await created.json()).data;
    check("create -> 201 with a uuid", created.status === 201 && /^[0-9a-f-]{36}$/.test(item?.uuid ?? ""), JSON.stringify(item));
    const second = await (await post("/api/template-items", { name: "second" })).json();
    check("rolling_id still increments on SQLite", Number.isInteger(item?.rolling_id) && second.data?.rolling_id > item.rolling_id, `${item?.rolling_id} -> ${second.data?.rolling_id}`);
    const updated = await post(`/api/template-items/${item.uuid}`, { status: "active" });
    check("update via POST /:uuid", updated.status === 200 && (await updated.json()).data?.status === "active");
    const list = await (await fetch(`${server.base}/api/template-items`)).json();
    check("list returns both rows", list.ok && list.data.length === 2);
    }
} catch (err) {
    check("SQLite checks could run", false, err.stack || err.message);
} finally {
    await stopServer(server);
    fs.rmSync(dir, { recursive: true, force: true });
}

done();
