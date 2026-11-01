// ⭐ Table naming canon (Ote's standard): mst_ / txn_ / log_ prefix, and ONE name end to
// end — model file, define() name, tableName and the db.<name> accessor are the same
// literal string. No database needed: models are defined on an unconnected Sequelize.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { BACKEND } from "../lib/backend.mjs";

const MODELS_DIR = path.join(BACKEND, "database", "models");
const { Sequelize } = createRequire(path.join(BACKEND, "package.json"))("sequelize");
const { default: initModels, CHOICES } = await import(pathToFileURL(path.join(MODELS_DIR, "index.js")).href);

const sequelize = new Sequelize({ dialect: "postgres", logging: false });
const { models } = initModels(sequelize, { project: "canon_test" });
const files = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith(".model.js"));

test("every model file is registered, under the same name", () => {
    assert.ok(files.length > 0);
    for (const file of files) {
        const name = file.replace(/\.model\.js$/, "");
        assert.ok(models[name], `${file} is not registered as db.${name} in database/models/index.js`);
        assert.ok(sequelize.models[name], `${file} must call sequelize.define("${name}", …)`);
    }
    assert.equal(Object.keys(models).length, files.length, "a registered model has no matching <name>.model.js file");
});

test("define() name, tableName and accessor are one literal string with a data-class prefix", () => {
    for (const [name, model] of Object.entries(models)) {
        assert.equal(model.name, name, `db.${name} is defined as "${model.name}"`);
        assert.equal(model.getTableName().tableName ?? model.getTableName(), name, `db.${name} maps to another table`);
        assert.match(name, /^(mst|txn|log)_[a-z0-9_]+$/, `${name} needs a mst_ / txn_ / log_ prefix`);
    }
});

test("every table has uuid PK, rolling_id and created_at", () => {
    for (const [name, model] of Object.entries(models)) {
        const attrs = model.getAttributes();
        assert.ok(attrs.uuid?.primaryKey, `${name}.uuid must be the primary key`);
        assert.ok(attrs.rolling_id?.autoIncrement && attrs.rolling_id?.unique, `${name}.rolling_id must be auto-increment + unique`);
        assert.ok(attrs.created_at, `${name} must have created_at`);
    }
});

test("CHOICES keys are <table>_<column> of a real model column", () => {
    for (const key of Object.keys(CHOICES)) {
        const table = Object.keys(models).find((name) => key.startsWith(`${name}_`));
        assert.ok(table, `CHOICES.${key} does not start with a table name`);
        assert.ok(models[table].getAttributes()[key.slice(table.length + 1)], `CHOICES.${key}: no such column`);
    }
});
