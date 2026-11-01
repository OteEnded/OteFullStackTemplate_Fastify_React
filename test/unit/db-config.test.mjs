// getDbConfig() is the one place connection settings come from — it must THROW on
// gaps instead of guessing (no `|| 5432`), and know which mode each dialect supports.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BACKEND } from "../lib/backend.mjs";

const { getDbConfig } = await import(pathToFileURL(path.join(BACKEND, "lib", "db-config.js")).href);
const pgConn = { dialect: "postgres", host: "127.0.0.1", port: 5432, database: "d", username: "u", password: "p", schemas: { project: "app" } };

test("a complete Postgres config resolves, migrate by default", () => {
    const db = getDbConfig({ database: { connection: pgConn } });
    assert.equal(db.schemaMode, "migrate");
    assert.deepEqual(db.schemas, { parent: "public", project: "app" });
});

test("missing values throw with every problem listed — never a guessed default", () => {
    assert.throws(
        () => getDbConfig({ database: { connection: { dialect: "postgres", host: "x" } } }),
        (err) => ["port", "database", "username", "schemas.project"].every((k) => err.problems.some((p) => p.includes(k))),
    );
});

test("SQLite needs a storage file and sync mode", () => {
    const db = getDbConfig({ database: { schema_mode: "sync", connection: { dialect: "sqlite", storage: "./data/x.sqlite" } } });
    assert.ok(path.isAbsolute(db.storage));
    assert.deepEqual(db.schemas, {});
    assert.throws(() => getDbConfig({ database: { connection: { dialect: "sqlite", storage: "./x" } } }), /use "sync" with SQLite/);
    assert.throws(() => getDbConfig({ database: { schema_mode: "sync", connection: { dialect: "sqlite" } } }), /storage is empty/);
});

test("non-Postgres SQL dialects are sync-only; unknown dialects and modes are refused", () => {
    const mysql = { dialect: "mysql", host: "h", port: 3306, database: "d", username: "u" };
    assert.equal(getDbConfig({ database: { schema_mode: "sync", connection: mysql } }).dialect, "mysql");
    assert.throws(() => getDbConfig({ database: { connection: mysql } }), /use "sync" with mysql/);
    assert.throws(() => getDbConfig({ database: { connection: { ...pgConn, dialect: "oracle" } } }), /dialect must be one of/);
    assert.throws(() => getDbConfig({ database: { schema_mode: "auto", connection: pgConn } }), /schema_mode/);
});
