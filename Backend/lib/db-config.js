import path from "path";
import { fileURLToPath } from "url";

// The ONE place that turns config.database into connection settings. The server,
// db:migrate, seeds and any script use it — never their own copy of the coordinates.
// It THROWS on anything missing instead of filling in `|| 5432`-style guesses: a
// guessed value doesn't fail, it connects somewhere plausible (OSM, and ~50 OLS
// scripts that "passed" for months against a stale database).

export const DIALECTS = ["postgres", "mysql", "mariadb", "mssql", "sqlite"];
export const SCHEMA_MODES = ["migrate", "sync"];

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getDbConfig(config) {
    const db = config?.database ?? {};
    const conn = db.connection ?? {};
    const problems = [];

    const dialect = conn.dialect;
    if (!DIALECTS.includes(dialect)) {
        problems.push(`database.connection.dialect must be one of ${DIALECTS.join(", ")} (got ${JSON.stringify(dialect)})`);
    }

    const schemaMode = db.schema_mode ?? "migrate";
    if (!SCHEMA_MODES.includes(schemaMode)) {
        problems.push(`database.schema_mode must be "migrate" or "sync" (got ${JSON.stringify(schemaMode)})`);
    }

    if (dialect === "sqlite") {
        if (!conn.storage) problems.push(`database.connection.storage is empty — the SQLite file path, e.g. "./data/app.sqlite"`);
        if (schemaMode === "migrate") {
            problems.push(`database.schema_mode "migrate" runs Postgres SQL files — use "sync" with SQLite (or add SQLite migrations + a loader)`);
        }
    } else if (dialect) {
        for (const key of ["host", "port", "database", "username"]) {
            if (conn[key] === undefined || conn[key] === "") problems.push(`database.connection.${key} is empty`);
        }
        if (conn.port !== undefined && !Number.isInteger(conn.port)) problems.push(`database.connection.port must be an integer`);
        if (dialect === "postgres" && !conn.schemas?.project) {
            problems.push(`database.connection.schemas.project is empty — every app gets its own Postgres schema`);
        }
        if (dialect !== "postgres" && schemaMode === "migrate") {
            problems.push(`database.schema_mode "migrate" runs Postgres SQL files — use "sync" with ${dialect} (or add ${dialect} migrations + a loader)`);
        }
    }

    if (problems.length) {
        const err = new Error(`Database config is incomplete:\n  - ${problems.join("\n  - ")}`);
        err.problems = problems;
        throw err;
    }

    return {
        dialect,
        schemaMode,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        username: conn.username,
        password: conn.password ?? "",
        // Schemas are a Postgres feature; other dialects get none (tables live in the database itself).
        schemas: dialect === "postgres" ? { parent: conn.schemas?.parent || "public", project: conn.schemas.project } : {},
        storage: dialect === "sqlite" ? path.resolve(backendRoot, conn.storage) : undefined,
    };
}
