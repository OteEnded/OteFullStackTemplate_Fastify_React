import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Op } from "sequelize";

// Log retention: logging.retention_days (0 / missing = keep forever).
// Without it, logs only grew: one message_*.log per boot (200+ files in OSM) and
// log_requests reached 132k rows in OLS.

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function pruneLogs(config, db, now = Date.now()) {
    const days = config?.logging?.retention_days;
    if (!Number.isFinite(days) || days <= 0) return { files: 0, rows: 0 };
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    // Files: only this app's log files (known prefixes) in the configured log folders.
    let files = 0;
    const sinks = ["message", "request", "sequelize"].map((key) => config.logging?.[key]).filter(Boolean);
    for (const sink of sinks) {
        const dir = path.resolve(backendRoot, sink.log_directory || "./logs");
        if (!fs.existsSync(dir)) continue;
        const prefix = sink.log_file_prefix || "";
        for (const name of fs.readdirSync(dir)) {
            if (!name.endsWith(".log") || (prefix && !name.startsWith(prefix))) continue;
            const file = path.join(dir, name);
            if (fs.statSync(file).mtimeMs < cutoff) {
                fs.rmSync(file, { force: true });
                files++;
            }
        }
    }

    // Rows: the append-only log tables.
    let rows = 0;
    for (const table of ["log_messages", "log_requests"]) {
        if (db?.[table]) {
            rows += await db[table].destroy({ where: { created_at: { [Op.lt]: new Date(cutoff) } } });
        }
    }
    return { files, rows };
}
