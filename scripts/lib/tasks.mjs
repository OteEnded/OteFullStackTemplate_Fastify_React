// The logic behind every launcher — ONE implementation for Windows and Linux, so the
// .bat and .sh files stay thin and can't drift apart (the old shell copies did, and
// installed deps only when node_modules was MISSING, so a pull with a new dependency
// crashed the next start; failed builds were ignored; exit codes were lost).
//
//   node scripts/lib/tasks.mjs dev      install if package.json changed → build frontend → migrate
//   node scripts/lib/tasks.mjs server   check deps + build exist → migrate            (no install/build)
//   node scripts/lib/tasks.mjs deploy   git pull (clean clone, ff-only) → install if changed → build → migrate
//
// Exits non-zero at the first failed step, so the launcher does NOT start the server.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BACKEND = path.join(ROOT, "Backend");
const FRONTEND = path.join(ROOT, "Frontend");

function step(title) {
    console.log(`\n[tasks] ${title}`);
}

function fail(message) {
    console.error(`\n[tasks] FAILED: ${message}\n`);
    process.exit(1);
}

function check(result, label, cwd) {
    if (result.status !== 0) fail(`${label} (in ${path.relative(ROOT, cwd) || "."}) exited with ${result.status}`);
}

// node itself: spawned directly (no shell — its path may contain spaces: C:\Program Files\nodejs).
function runNode(args, cwd) {
    check(spawnSync(process.execPath, args, { cwd, stdio: "inherit" }), `node ${args.join(" ")}`, cwd);
}

// npm is a .cmd script on Windows, which needs a shell; pass ONE command string
// (fixed, trusted arguments) rather than an args array through the shell.
function runNpm(command, cwd) {
    check(spawnSync(`npm ${command}`, { cwd, stdio: "inherit", shell: true }), `npm ${command}`, cwd);
}

// Install when package.json changed since the last install — not merely when
// node_modules is missing. The stamp is a hash of package.json kept in node_modules.
function installIfChanged(dir) {
    const name = path.basename(dir);
    const pkg = fs.readFileSync(path.join(dir, "package.json"), "utf8");
    const hash = crypto.createHash("sha256").update(pkg.replace(/\r\n/g, "\n")).digest("hex");
    const stamp = path.join(dir, "node_modules", ".install-stamp");
    const current = fs.existsSync(stamp) ? fs.readFileSync(stamp, "utf8").trim() : "";
    if (current === hash) {
        console.log(`[tasks] ${name}: dependencies up to date`);
        return;
    }
    step(`${name}: installing dependencies (${current ? "package.json changed" : "first install"})`);
    runNpm("install --no-fund --no-audit", dir);
    fs.writeFileSync(stamp, hash);
}

function requireInstalled(dir) {
    if (!fs.existsSync(path.join(dir, "node_modules"))) {
        fail(`${path.basename(dir)}/node_modules is missing — run the deploy script (or the dev launcher) first`);
    }
}

function buildFrontend() {
    step("Frontend: building into Backend/public/dist");
    runNpm("run build", FRONTEND);
}

function requireBuild() {
    if (!fs.existsSync(path.join(BACKEND, "public", "dist", "index.html"))) {
        fail("Backend/public/dist is missing — the frontend was never built. Run the deploy script first.");
    }
}

// A deploy pulls first — fast-forward only, and only into a CLEAN clone: local edits to tracked
// files would make `git pull` refuse halfway, so they are named up front instead.
function gitPull() {
    step("git: pulling (fast-forward only)");
    const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: ROOT, encoding: "utf8" });
    if (status.status !== 0) fail(`not a git checkout (git status: ${String(status.stderr).trim()})`);
    if (status.stdout.trim()) {
        fail(`this clone has local changes to tracked files — a deploy needs a clean clone:\n${status.stdout.trimEnd()}\n` +
            "Commit them to the project (if they belong there) or `git checkout -- <file>`, then deploy again.");
    }
    check(spawnSync("git", ["pull", "--ff-only"], { cwd: ROOT, stdio: "inherit" }), "git pull --ff-only", ROOT);
}

async function migrateIfNeeded() {
    const configFile = path.join(BACKEND, "config.json");
    if (!fs.existsSync(configFile)) fail("Backend/config.json is missing — run the wizard (wizard.bat / wizard.sh) first");
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configFile, "utf8").replace(/^﻿/, ""));
    } catch (err) {
        fail(`Backend/config.json is not valid JSON: ${err.message}`);
    }
    if (config.database?.enabled === false) {
        console.log("[tasks] database disabled — no migrations to run");
        return;
    }
    const { getDbConfig } = await import(pathToFileURL(path.join(BACKEND, "lib", "db-config.js")).href);
    let db;
    try {
        db = getDbConfig(config);
    } catch (err) {
        fail(err.message);
    }
    if (db.schemaMode !== "migrate") {
        console.log(`[tasks] schema_mode "${db.schemaMode}" — tables come from the models, no migrations to run`);
        return;
    }
    step("Database: applying migrations");
    runNode(["database/migrate.js"], BACKEND);
}

const task = process.argv[2];
switch (task) {
    case "dev":
        installIfChanged(BACKEND);
        installIfChanged(FRONTEND);
        buildFrontend();
        await migrateIfNeeded();
        break;
    case "server":
        requireInstalled(BACKEND);
        requireBuild();
        await migrateIfNeeded();
        break;
    case "deploy":
        gitPull();
        installIfChanged(BACKEND);
        installIfChanged(FRONTEND);
        buildFrontend();
        await migrateIfNeeded();
        break;
    default:
        fail(`unknown task "${task ?? ""}" — use dev, server or deploy`);
}
console.log(`\n[tasks] ${task}: ready`);
