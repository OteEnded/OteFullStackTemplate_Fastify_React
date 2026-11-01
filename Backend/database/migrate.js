// Apply the SQL migrations in database/migrations/, in filename order.
//
//   npm run db:migrate                         apply every file not yet recorded, each in its own transaction
//   npm run db:status                          list each file: applied (when) / pending / CHANGED / MISSING
//   npm run db:migrate -- --baseline 002       adopt a database that predates the record: mark 001…002 as applied
//                                              WITHOUT running them (only when the record is empty), then apply the rest
//   node database/migrate.js --config <file>   against another config (tests, a second instance)
//
// Lifted from DragonConnect_Core_V2 (ed9c80b), where it was learned the hard way:
// - ⭐ each file runs ONCE. log_migrations records every applied file with a checksum; an applied
//   file that changed since is REFUSED (never edit an applied migration; add a new one).
//   Re-running everything every time once let 010 undo what 011 added.
// - It REFUSES TO RUN AS A SUPERUSER: objects a superuser creates are owned by it and unwritable
//   by the app role, so "apply as the app role" is enforced here, not hoped for in a README.
// - A schema with tables but an empty record is refused (it would re-run everything): baseline it.
// - It stops at the first failure, with nothing half-applied from that file.
// - Afterwards it reports what the database ACTUALLY holds, read from the catalog.
//
// Postgres only (the SQL files are Postgres). Other dialects use database.schema_mode "sync".

import pg from "pg";
import { loadConfig } from "../lib/utility.js";
import { getDbConfig } from "../lib/db-config.js";
import { readMigrationFiles, compareWithLedger, LEDGER_TABLE } from "./migration-files.js";

const args = process.argv.slice(2);
const argValue = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const statusOnly = args.includes("--status");
const baseline = argValue("--baseline");

let db;
try {
    db = getDbConfig(loadConfig(argValue("--config")));
} catch (err) {
    console.error(`db:migrate: ${err.message}`);
    process.exit(1);
}
if (db.dialect !== "postgres") {
    console.error(`db:migrate: the SQL migrations are Postgres — this config uses ${db.dialect}. Use database.schema_mode "sync" instead.`);
    process.exit(1);
}
if (args.includes("--baseline") && !/^\d{3}$/.test(baseline ?? "")) {
    console.error("usage: npm run db:migrate -- --baseline <NNN>   (the last migration this database already has, e.g. 002)");
    process.exit(2);
}

const schema = db.schemas.project;
const LEDGER = `"${schema}".${LEDGER_TABLE}`;
const files = readMigrationFiles();
const client = new pg.Client({ host: db.host, port: db.port, user: db.username, password: db.password, database: db.database });

let exitCode = 0;
try {
    await client.connect();

    const { rows: [who] } = await client.query(
        "SELECT current_user AS role, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser",
    );
    if (who.superuser) {
        throw new Error(`refusing to migrate as superuser "${who.role}" — apply migrations as the app role (the one in config.json)`);
    }
    console.log(`db:migrate as ${who.role} on ${db.database}, schema ${schema}: ${files.length} file(s)`);

    // The record lives in the project schema; the runner owns it (it must exist before any migration runs).
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS ${LEDGER} (
            filename     varchar(255)  PRIMARY KEY,
            checksum     char(64)      NOT NULL,
            applied_at   timestamptz   NOT NULL DEFAULT now(),
            applied_by   varchar(128)  NOT NULL,
            duration_ms  integer,
            init_via     varchar(16)   NOT NULL DEFAULT 'run'
                         CONSTRAINT log_migrations_init_via_check CHECK (init_via IN ('run', 'baseline')),
            created_at   timestamptz   NOT NULL DEFAULT now()
        )`);
    await client.query(`COMMENT ON TABLE ${LEDGER} IS 'Every migration file applied, once (database/migrate.js). init_via baseline = adopted without running.'`);

    const ledgerRows = (await client.query(`SELECT filename, checksum, applied_at, init_via FROM ${LEDGER}`)).rows;
    const applied = new Map(ledgerRows.map((r) => [r.filename, r]));
    const { changed, missing } = compareWithLedger(files, ledgerRows);

    if (statusOnly) {
        for (const f of files) {
            const a = applied.get(f.filename);
            const state = !a ? "pending " : changed.includes(f.filename) ? "CHANGED " : "applied ";
            console.log(`  ${state} ${f.filename}${a ? `  (${a.init_via} ${a.applied_at.toISOString()})` : ""}`);
        }
        for (const name of missing) console.log(`  MISSING  ${name}  (recorded, but the file is gone)`);
    } else {
        if (changed.length) {
            throw new Error(`already-applied migration(s) changed since they ran: ${changed.join(", ")}. Never edit an applied migration; put the change in a new one.`);
        }
        if (baseline) {
            if (applied.size) throw new Error(`--baseline is only for a database with no record yet (this one has ${applied.size} entr${applied.size === 1 ? "y" : "ies"})`);
            const adopt = files.filter((f) => f.filename.slice(0, 3) <= baseline);
            if (!adopt.length || adopt.at(-1).filename.slice(0, 3) !== baseline) throw new Error(`no migration ${baseline}_*.sql to baseline at`);
            for (const f of adopt) {
                await client.query(`INSERT INTO ${LEDGER} (filename, checksum, applied_by, init_via) VALUES ($1, $2, $3, 'baseline')`, [f.filename, f.checksum, who.role]);
                applied.set(f.filename, f);
                console.log(`  baseline ${f.filename}`);
            }
        } else if (!applied.size) {
            const { rows: [{ n }] } = await client.query(
                `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' AND table_name <> $2`,
                [schema, LEDGER_TABLE],
            );
            if (n > 0) {
                throw new Error(`schema ${schema} already has ${n} table(s) but no migration record. Adopt it first: npm run db:migrate -- --baseline <the last migration it has>`);
            }
        }

        let ran = 0;
        for (const f of files) {
            if (applied.has(f.filename)) continue;
            const started = Date.now();
            await client.query("BEGIN");
            try {
                // Unqualified names in the files land in the project schema.
                await client.query(`SET LOCAL search_path TO "${schema}", public`);
                await f.loader(client, f.source);
                await client.query(`INSERT INTO ${LEDGER} (filename, checksum, applied_by, duration_ms) VALUES ($1, $2, $3, $4)`, [f.filename, f.checksum, who.role, Date.now() - started]);
                await client.query("COMMIT");
                ran++;
                console.log(`  applied  ${f.filename}`);
            } catch (err) {
                await client.query("ROLLBACK");
                throw new Error(`${f.filename} failed and was rolled back: ${err.message}`);
            }
        }
        console.log(ran ? `${ran} migration(s) applied` : "nothing to apply: every migration is already recorded");
    }

    // ⚠ `table_name::text` — a bare information_schema identifier column comes back as a
    // positional array in some drivers; the cast returns a normal { table_name } row.
    const { rows } = await client.query(
        `SELECT table_name::text AS table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY 1`,
        [schema],
    );
    console.log(`schema ${schema} now holds ${rows.length} table(s): ${rows.map((r) => r.table_name).join(", ")}`);
} catch (err) {
    console.error(`db:migrate FAILED: ${err.message}`);
    exitCode = 1;
} finally {
    await client.end().catch(() => {});
}
process.exit(exitCode);
