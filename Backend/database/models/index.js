import { DataTypes } from "sequelize";
import log_messages from "./log_messages.model.js";
import log_requests from "./log_requests.model.js";
import mst_users from "./mst_users.model.js";
import mst_template_items from "./mst_template_items.model.js"; // @demo

// ⭐ Table naming (Ote's standard): a data-class prefix + ONE name end to end.
//   mst_  master — what exists (config, identity, definitions, reference data)
//   txn_  transaction — what happened or is in flight
//   log_  append-only audit / telemetry
// The model file, define() name, tableName and the db.<name> accessor are the SAME
// literal string — no PascalCase alias, no mapping helper. test/unit/table-names
// fails if they drift. Every table: uuid PK + rolling_id + created_at (+ updated_at).

// Allowed values for constrained columns, keyed <table>_<column>. ONE list, used by
// the model validators, the route JSON schemas and the CHECK constraints in the
// migrations (test/checks/database.check compares them), so they can't drift.
export const CHOICES = {
    log_messages_level: ["info", "warning", "error"],
    mst_template_items_status: ["draft", "active", "archived"], // @demo
    mst_template_items_priority: ["low", "medium", "high"], // @demo
};

const MODEL_FACTORIES = {
    log_messages,
    log_requests,
    mst_users,
    mst_template_items, // @demo
};

export default function initModels(sequelize, schemas) {
    const choices = CHOICES;

    // Sequelize lifecycle hooks, keyed by TABLE name. Add one entry per model whose
    // rows need logic on create/update/etc.
    const hooks = {
        // @demo-start — example hook on the demo table
        mst_template_items: {
            // beforeSave runs before every create AND update. Here it normalizes
            // the name (trims surrounding whitespace) and keeps summary a string.
            beforeSave(instance) {
                if (typeof instance.name === "string") {
                    instance.name = instance.name.trim();
                }
                if (instance.summary == null) {
                    instance.summary = "";
                }
            },
            // Other hooks you can add: beforeValidate, beforeCreate, afterCreate,
            // beforeUpdate, afterUpdate, afterFind, beforeDestroy, ...
            // Docs: https://sequelize.org/docs/v6/other-topics/hooks/
        },
        // @demo-end
    };

    const models = {};
    for (const [name, factory] of Object.entries(MODEL_FACTORIES)) {
        models[name] = factory(sequelize, DataTypes, schemas, choices, hooks);
    }

    if (sequelize.getDialect() === "sqlite") {
        for (const model of Object.values(models)) fillRollingIdOnSqlite(model);
    }

    return { models, choices };
}

// SQLite only allows AUTOINCREMENT on an INTEGER PRIMARY KEY, so on a uuid-PK table
// Sequelize silently drops it from rolling_id — leaving a NOT NULL column nothing fills,
// and every insert fails. (Postgres identity, MySQL and MSSQL all support it on a unique
// non-PK column.) Here the next value is assigned in a hook; SQLite serialises writes, so
// max + 1 can't race.
function fillRollingIdOnSqlite(model) {
    if (!model.getAttributes().rolling_id?.autoIncrement) return;
    const nextId = async (options) => ((await model.max("rolling_id", { transaction: options.transaction })) ?? 0) + 1;

    model.addHook("beforeCreate", async (instance, options) => {
        if (instance.rolling_id == null) instance.rolling_id = await nextId(options);
    });
    model.addHook("beforeBulkCreate", async (instances, options) => {
        let next = await nextId(options);
        for (const instance of instances) {
            if (instance.rolling_id == null) instance.rolling_id = next++;
        }
    });
}
