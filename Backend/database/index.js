import { Sequelize } from "sequelize";
import { loadConfig, log, logQuery } from "../lib/utility.js";
import { getDbConfig } from "../lib/db-config.js";
import initModels from "./models/index.js";
import { assertSchemaReady } from "./schema-guard.js";

// Connects, defines the models and makes sure the schema is ready — per
// database.schema_mode:
//
//   "migrate" (default, Postgres) — the SQL files in database/migrations/ OWN the schema.
//             `npm run db:migrate` applies them; this boot NEVER creates or alters a table.
//             The schema guard refuses to start with pending migrations or a model
//             that has no table.
//   "sync"    — models create missing tables (sequelize.sync, never alter/force). For
//             quick prototypes and SQLite / other dialects. Can't express CHECKs,
//             partial indexes or NOT NULL owner columns — move to "migrate" for real data.
//
// Seeding is NOT done at boot any more: `npm run db:seed`.
export async function initDB() {
    // Config is read HERE, not at module top: importing this file must have no side effects.
    const config = loadConfig();
    const db = getDbConfig(config);
    const sequelizeLogging = config.logging?.sequelize || {};
    const logQueries = sequelizeLogging.log_to_file !== false || sequelizeLogging.log_to_console === true;

    const options = {
        dialect: db.dialect,
        benchmark: sequelizeLogging.benchmark !== false,
        logging: logQueries ? (query, duration) => logQuery(query, duration) : false,
    };
    const sequelize = db.dialect === "sqlite"
        ? new Sequelize({ ...options, storage: db.storage })
        : new Sequelize(db.database, db.username, db.password, { ...options, host: db.host, port: db.port });

    await sequelize.authenticate();
    const { models, choices } = initModels(sequelize, db.schemas);

    if (db.schemaMode === "migrate") {
        const ready = await assertSchemaReady(sequelize, db.schemas.project);
        await log(`Database ready (migrate mode): schema "${db.schemas.project}", ${ready.tables} tables, ${ready.models} models`, import.meta.url);
    } else {
        if (db.dialect === "postgres") {
            await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${db.schemas.project}"`);
        }
        await sequelize.sync(); // create missing tables only — never alter/force
        await log(`Database ready (sync mode, ${db.dialect}) — models created any missing tables`, import.meta.url);
    }

    return { sequelize, ...models, choices };
}
