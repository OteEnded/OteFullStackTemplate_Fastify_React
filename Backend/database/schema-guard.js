import { QueryTypes } from "sequelize";
import { readMigrationFiles, compareWithLedger, LEDGER_TABLE } from "./migration-files.js";

// SCHEMA GUARD — makes "the SQL migration is the source of truth" a MECHANISM, not a hope.
// Runs at boot in database.schema_mode "migrate" (Postgres) and refuses to start when:
//   1. migrations are pending, changed, or were never run  → "run npm run db:migrate"
//   2. a model has no table                                 → a migration is missing
//
// Adapted from DragonConnect_Core_V2's schema-guard.js (from EnterpriseAgentPlatform). That
// guard ran sync() and failed if sync had CREATED anything — it found 8 duplicate indexes
// that way. This version never calls sync() in migrate mode at all, so nothing can be created
// behind the migrations' back; it only OBSERVES the database and compares.
//
// ⚠ Two silent query traps, both measured in DCON — keep the `type: SELECT` and the casts:
//   - without `type: QueryTypes.SELECT`, sequelize.query resolves to [rows, metadata], so
//     `const [rows] = await …` binds the FIRST ROW — the first DCON guard reported "1 table"
//     for a 38-table schema and called it success.
//   - a bare information_schema identifier column (sql_identifier) comes back positional;
//     `table_name::text AS table_name` returns a normal { table_name } object.

async function select(sequelize, sql, replacements) {
    const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
    if (!Array.isArray(rows)) throw new Error("schema-guard: expected an array of rows — query shape changed, refusing to guess");
    return rows;
}

export async function assertSchemaReady(sequelize, schema) {
    if (!schema) throw new Error("schema-guard: no project schema configured — refusing to guess one");

    const tables = new Set(
        (await select(
            sequelize,
            `SELECT table_name::text AS table_name FROM information_schema.tables
              WHERE table_schema = :schema AND table_type = 'BASE TABLE'`,
            { schema },
        )).map((r) => r.table_name),
    );
    if ([...tables].some((t) => typeof t !== "string")) {
        throw new Error("schema-guard: rows have no table_name — cannot verify the schema, refusing to guess");
    }

    const howToFix = `  Apply migrations AS THE APP ROLE before starting:\n    cd Backend && npm run db:migrate`;

    if (!tables.has(LEDGER_TABLE)) {
        throw new Error(`schema-guard: schema "${schema}" has no ${LEDGER_TABLE} — migrations were never applied.\n${howToFix}`);
    }

    const ledger = await select(sequelize, `SELECT filename, checksum FROM "${schema}".${LEDGER_TABLE}`);
    const { pending, changed } = compareWithLedger(readMigrationFiles(), ledger);
    if (changed.length) {
        throw new Error(`schema-guard: applied migration(s) were edited afterwards: ${changed.join(", ")}.\n  Never edit an applied migration — restore it and add a new numbered file.`);
    }
    if (pending.length) {
        throw new Error(`schema-guard: ${pending.length} pending migration(s): ${pending.join(", ")}.\n${howToFix}`);
    }

    // Every model must map to a table some migration created.
    const missing = Object.values(sequelize.models)
        .map((model) => model.getTableName())
        .map((name) => (typeof name === "string" ? name : name.tableName))
        .filter((name) => !tables.has(name));
    if (missing.length) {
        throw new Error(
            `schema-guard: model(s) without a table: ${missing.join(", ")}.\n` +
            `  A model was added without its migration. Add the CREATE TABLE in a new\n` +
            `  database/migrations/NNN_*.sql, run npm run db:migrate, and restart.`,
        );
    }

    return { tables: tables.size, models: Object.keys(sequelize.models).length };
}
