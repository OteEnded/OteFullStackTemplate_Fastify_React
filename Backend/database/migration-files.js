import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Shared by database/migrate.js (applies migrations) and database/schema-guard.js
// (refuses to boot with pending ones), so both agree on what "pending" means.

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
export const LEDGER_TABLE = "log_migrations";

// Line endings don't count: a checkout with CRLF must not look like an edited file.
export const checksum = (text) => crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");

// Migration "loaders" by file type. Only SQL today (agent-written, Postgres — Ote's
// option a). A JS loader for hand-written, dialect-agnostic migrations (option b,
// e.g. umzug + queryInterface) plugs in here without changing the ledger.
export const LOADERS = {
    ".sql": async (client, source) => client.query(source),
};

export function readMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => /^\d{3}_.+\.[a-z]+$/.test(f) && LOADERS[path.extname(f)])
        .sort()
        .map((filename) => {
            const source = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
            return { filename, source, checksum: checksum(source), loader: LOADERS[path.extname(filename)] };
        });
}

// Compare the files with the ledger rows ({ filename, checksum }).
export function compareWithLedger(files, ledgerRows) {
    const applied = new Map(ledgerRows.map((r) => [r.filename, r]));
    return {
        pending: files.filter((f) => !applied.has(f.filename)).map((f) => f.filename),
        changed: files.filter((f) => applied.has(f.filename) && applied.get(f.filename).checksum !== f.checksum).map((f) => f.filename),
        missing: [...applied.keys()].filter((name) => !files.some((f) => f.filename === name)),
    };
}
