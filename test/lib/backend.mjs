// Shared helpers for tests: build a TEST config, load the backend modules, start a
// private instance. Tests never use Backend/config.json (that is the developer's —
// or a server's — real config); they derive from config.example.json instead.
//
//   TEST_PORT        reserved test port = app.port + 1 (Ote's port rule: variant 1)
//   testConfig(o)    example config + test defaults + overrides (deep-merged)
//   writeConfig(c)   write it to a temp file, return the path (for `--config`)
//   loadBackend(c)   seed the backend's config cache with c, return { buildApp, utility, ... }
//   startServer(c)   spawn `node server.js --config <tmp>` on c.app.port, wait for /api/health

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
export const BACKEND = path.join(ROOT, "Backend");

const example = JSON.parse(fs.readFileSync(path.join(BACKEND, "config.example.json"), "utf-8"));

// The test port is THIS project's port + 1 (Ote's port rule: variant 1 of the app's own id), so
// two projects on one machine never test on the same port. Only app.port is read from
// Backend/config.json — nothing else from the real config ever reaches a test.
function projectPort() {
    try {
        const raw = fs.readFileSync(path.join(BACKEND, "config.json"), "utf-8").replace(/^﻿/, "");
        const port = JSON.parse(raw)?.app?.port;
        if (Number.isInteger(port)) return port;
    } catch {
        // no config.json yet (fresh clone, CI) — use the example's port
    }
    return example.app.port;
}
export const TEST_PORT = projectPort() + 1;

// Temp folders (test configs, test logs) are removed when the test process exits.
const tempDirs = [];
function tempDir(prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
}
process.on("exit", () => {
    for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function merge(base, extra) {
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) return extra === undefined ? base : extra;
    const out = { ...base };
    for (const [key, value] of Object.entries(extra)) out[key] = merge(base?.[key], value);
    return out;
}

// Optional local DB settings for tests: test/test.config.json (gitignored), same
// shape as Backend/config.json's "database" block. Missing => DB checks SKIP.
export function localTestDatabase() {
    const file = path.join(ROOT, "test", "test.config.json");
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8").replace(/^﻿/, "")).database ?? null;
}

export function testConfig(overrides = {}) {
    const logDir = tempDir("fst-test-logs-");
    const base = merge(structuredClone(example), {
        app: { port: TEST_PORT, host: "127.0.0.1" },
        logging: {
            message: { log_to_console: false, log_directory: logDir },
            request: { log_directory: logDir },
            sequelize: { log_directory: logDir },
        },
        database: { enabled: false },
    });
    delete base._comments;
    return merge(base, overrides);
}

export function writeConfig(config) {
    const file = path.join(tempDir("fst-test-config-"), "config.json");
    fs.writeFileSync(file, JSON.stringify(config, null, 2));
    return file;
}

const backendUrl = (rel) => pathToFileURL(path.join(BACKEND, rel)).href;

// The backend caches the FIRST config it loads for the whole process, so this
// must run before anything else touches the backend in a test process.
export async function loadBackend(config) {
    const utility = await import(backendUrl("lib/utility.js"));
    utility.loadConfig(writeConfig(config));
    const { buildApp } = await import(backendUrl("app.js"));
    const { checkConfig } = await import(backendUrl("lib/config-check.js"));
    const http = await import(backendUrl("lib/http.js"));
    return { buildApp, checkConfig, utility, http };
}

export function runServer(configFile, { capture = true } = {}) {
    return spawn(process.execPath, ["server.js", "--config", configFile], {
        cwd: BACKEND,
        stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
}

export async function portIsFree(port) {
    try {
        await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(800) });
        return false;
    } catch (err) {
        return err.cause?.code === "ECONNREFUSED";
    }
}

// Starts a private instance and waits until it answers. Fails fast — with ITS OWN
// message — when the port is taken or the server dies: a suite that cannot reach
// the server must report that, not a product failure.
export async function startServer(config, { timeoutMs = 20000 } = {}) {
    const port = config.app.port;
    if (!(await portIsFree(port))) {
        throw new Error(`test port ${port} is already in use — stop whatever runs there (an old test instance?)`);
    }
    const file = writeConfig(config);
    const child = runServer(file);
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`test server exited (${child.exitCode}) during startup:\n${output}`);
        try {
            const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
            if (res.status < 500 || res.status === 503) return { child, file, port, base: `http://127.0.0.1:${port}`, output: () => output };
        } catch {
            // not up yet
        }
        await new Promise((r) => setTimeout(r, 300));
    }
    child.kill();
    throw new Error(`test server did not answer within ${timeoutMs} ms:\n${output}`);
}

export async function stopServer(server) {
    if (!server || server.child.exitCode !== null) return;
    const exited = new Promise((resolve) => server.child.once("exit", resolve));
    server.child.kill();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
}
