// Project setup wizard — run once after cloning (wizard.bat / wizard.sh call this).
// Re-runnable. One implementation for Windows and Linux.
//
//   node scripts/wizard.mjs                       interactive
//   node scripts/wizard.mjs --answers a.json      unattended (keys = question ids below; missing ones use defaults)
//
// It writes Backend/config.json (from config.example.json), names the app, generates
// secrets, can remove the demo, creates the root launchers for your OS, installs the
// dependencies (which also clears VS Code's "Cannot find type definition file for
// 'vite/client'" — that error only means Frontend/node_modules isn't installed), can
// apply migrations, and prints what to enter in OteServerManager.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { demoPresent, removeDemo } from "./lib/demo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = path.join(ROOT, "Backend");
const FRONTEND = path.join(ROOT, "Frontend");
const IS_WIN = process.platform === "win32";
const TEMPLATE_PORT = 8080; // Ote's reserved template port (rule XX YY Z: zone 08, id 08)

const args = process.argv.slice(2);
const answersFile = args.includes("--answers") ? args[args.indexOf("--answers") + 1] : null;
const preset = answersFile ? JSON.parse(fs.readFileSync(answersFile, "utf8")) : null;
const rl = preset ? null : readline.createInterface({ input: process.stdin, output: process.stdout });

const say = (text = "") => console.log(text ? `  ${text}` : "");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 4)}\n`);

async function ask(id, question, fallback, { validate, choices } = {}) {
    if (preset) {
        const value = preset[id] ?? fallback;
        const problem = validate?.(String(value));
        if (problem) throw new Error(`answers.${id}: ${problem}`);
        return value;
    }
    const hint = choices ? ` (${choices.join("/")})` : "";
    for (;;) {
        const raw = (await rl.question(`  ${question}${hint} [${fallback}]: `)).trim();
        const value = raw === "" ? String(fallback) : raw;
        if (choices && !choices.includes(value)) {
            say(`  Please answer one of: ${choices.join(", ")}`);
            continue;
        }
        const problem = validate?.(value);
        if (problem) {
            say(`  ${problem}`);
            continue;
        }
        return value;
    }
}
const yes = async (id, question, fallback) => /^y/i.test(String(await ask(id, question, fallback ? "y" : "n", { choices: ["y", "n"] })));

// node: spawned directly (its path may contain spaces). npm: a .cmd on Windows, so it
// goes through the shell as ONE command string of fixed, trusted arguments.
const runNode = (nodeArgs, cwd) => spawnSync(process.execPath, nodeArgs, { cwd, stdio: "inherit" }).status === 0;
const runNpm = (command, cwd) => spawnSync(`npm ${command}`, { cwd, stdio: "inherit", shell: true }).status === 0;

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
const secret = () => crypto.randomBytes(32).toString("base64url");

// Secrets the wizard may GENERATE — an explicit list on purpose. A secret that comes from
// somewhere else (e.g. auth.oteracount.clientSecret, issued when the client is registered
// in Oteracount) must stay a visible placeholder until a person pastes the real one.
const GENERATED_SECRETS = [
    ["auth", "session", "secret"],
    ["security", "secret_box_key"],
];
function fillSecrets(config) {
    let count = 0;
    for (const keys of GENERATED_SECRETS) {
        const parent = keys.slice(0, -1).reduce((node, key) => node?.[key], config);
        const last = keys.at(-1);
        if (parent && (parent[last] === "" || parent[last] === "CHANGE_ME")) {
            parent[last] = secret();
            count++;
        }
    }
    return count;
}

async function main() {
    const major = Number(process.versions.node.split(".")[0]);
    if (major < 24) throw new Error(`Node.js 24 or newer is required (this is ${process.version})`);

    say();
    say("Project setup wizard");
    say("--------------------");
    say("Press Enter to accept the [default].");
    say();

    const configFile = path.join(BACKEND, "config.json");
    let writeConfig = true;
    if (fs.existsSync(configFile)) {
        writeConfig = await yes("overwrite_config", "Backend/config.json already exists. Replace it?", false);
        if (!writeConfig) say("Keeping your config.json — only launchers / install / migrate steps will run.");
    }

    const config = writeConfig ? readJson(path.join(BACKEND, "config.example.json")) : readJson(configFile);

    if (writeConfig) {
        // --- identity + network ---
        const name = await ask("name", "App name", path.basename(ROOT).replace(/[-_]+/g, " "));
        const slug = await ask("slug", "App slug (lowercase, dashes — unique per host)", slugify(name), {
            validate: (v) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? null : "use lowercase letters, digits and single dashes"),
        });
        let port = Number(await ask("port", "Port (Ote's rule XX YY Z, 8000–10999; the test instance uses port + 1)", TEMPLATE_PORT, {
            validate: (v) => (!/^\d+$/.test(v) || +v < 1 || +v > 65534 ? "a number 1–65534"
                : +v === 3000 ? "3000 collides with everything — pick an allocated port" : null),
        }));
        if (port === TEMPLATE_PORT && !(await yes("keep_template_port", `${TEMPLATE_PORT} is the TEMPLATE's reserved port. Keep it anyway?`, false))) {
            port = Number(await ask("port_again", "Port for this project", 8090, { validate: (v) => (/^\d+$/.test(v) ? null : "a number") }));
        }
        const lan = await yes("lan", "Serve other machines too (bind 0.0.0.0)? No = this machine only", false);
        Object.assign(config.app, { name, slug, port, host: lan ? "0.0.0.0" : "127.0.0.1" });

        // --- database ---
        const dbMode = await ask("database", "Database", "none", { choices: ["none", "postgres", "sqlite", "mysql", "mariadb", "mssql"] });
        const conn = config.database.connection;
        if (dbMode === "none") {
            config.database.enabled = false;
        } else {
            config.database.enabled = true;
            conn.dialect = dbMode;
            if (dbMode === "sqlite") {
                config.database.schema_mode = "sync";
                conn.storage = await ask("sqlite_file", "SQLite file (relative to Backend/)", `./data/${slug}.sqlite`);
            } else {
                const defaults = { postgres: 5432, mysql: 3306, mariadb: 3306, mssql: 1433 };
                conn.host = await ask("db_host", "DB host", "127.0.0.1");
                conn.port = Number(await ask("db_port", "DB port", defaults[dbMode], { validate: (v) => (/^\d+$/.test(v) ? null : "a number") }));
                conn.database = await ask("db_name", "DB name", slug.replace(/-/g, "_"));
                conn.username = await ask("db_user", "DB user (the app role — NOT a superuser)", slug.replace(/-/g, "_"));
                conn.password = await ask("db_password", "DB password (shown as you type; stored only in Backend/config.json)", "");
                if (dbMode === "postgres") {
                    conn.schemas.project = await ask("db_schema", "Postgres schema for this app", slug.replace(/-/g, "_"));
                    config.database.schema_mode = "migrate";
                } else {
                    config.database.schema_mode = "sync"; // the shipped SQL migrations are Postgres
                }
            }
        }

        // --- optional modules ---
        const auth = config.auth;
        auth.enabled = await yes("auth", "Enable sign-in (the auth module)?", false);
        if (auth.enabled) {
            const rootPassword = await ask("root_password", "Root password (config account, works without a DB; stored only as a bcrypt hash)", "", {
                validate: (v) => (v.length >= 10 ? null : "at least 10 characters"),
            });
            // Hashing needs bcryptjs; on a fresh clone the Backend isn't installed yet — do it now.
            const bcryptFile = path.join(BACKEND, "node_modules", "bcryptjs", "index.js");
            if (!fs.existsSync(bcryptFile)) {
                say("Installing Backend dependencies (needed to hash the password)...");
                if (!runNpm("install --no-fund --no-audit", BACKEND)) throw new Error("npm install in Backend failed");
            }
            const { default: bcrypt } = await import(pathToFileURL(bcryptFile).href);
            auth.root.password_hash = await bcrypt.hash(rootPassword, 12);
            auth.local_users.enabled = config.database.enabled === true && (await yes("local_users", "Local user accounts in the database (npm run auth:user)?", true));
            auth.oteracount.enabled = await yes("oteracount", "Login with Oteracount? (register the client first — GUIDE_OOAuth_for_apps.md)", false);
            if (auth.oteracount.enabled) {
                auth.oteracount.issuer = await ask("oteracount_issuer", "Oteracount issuer URL", "");
                auth.oteracount.clientId = await ask("oteracount_client_id", "Client ID (as registered)", slug);
                auth.oteracount.clientSecret = await ask("oteracount_client_secret", "Client secret (from the registration)", "CHANGE_ME");
                const origin = await ask("public_origin", "This app's public origin (what browsers use)", `http://localhost:${port}`);
                auth.oteracount.redirectUri = `${origin}/api/auth/oteracount/callback`;
                auth.oteracount.postLogoutRedirectUri = `${origin}/login`;
                say(`Register this redirect URI in Oteracount exactly: ${auth.oteracount.redirectUri}`);
            }
        }
        config.realtime.sse.enabled = await yes("sse", "Server-Sent Events push (GET /api/events)?", false);
        config.realtime.websocket.enabled = await yes("websocket", "WebSocket push (GET /api/ws)?", false);

        const generated = fillSecrets(config);
        writeJson(configFile, config);
        say(`Wrote Backend/config.json${generated ? ` (${generated} secret(s) generated)` : ""}`);

        // Name the frontend and the packages after the app.
        const feConfigFile = path.join(FRONTEND, "public", "config.json");
        const feConfig = fs.existsSync(feConfigFile) ? readJson(feConfigFile) : { app: {}, api: { base_url: "" } };
        feConfig.app = { ...feConfig.app, name };
        writeJson(feConfigFile, feConfig);
        for (const [dir, suffix] of [[BACKEND, "backend"], [FRONTEND, "frontend"], [path.join(ROOT, "test"), "test"]]) {
            const pkgFile = path.join(dir, "package.json");
            if (!fs.existsSync(pkgFile)) continue;
            const pkg = readJson(pkgFile);
            pkg.name = `${slug}-${suffix}`;
            pkg.version = "0.1.0";
            if (suffix === "backend") pkg.description = `Backend for ${name}`;
            writeJson(pkgFile, pkg);
        }
        say(`Named the app "${name}" (frontend config + package names)`);
    }

    // --- demo ---
    if (demoPresent(ROOT) && (await yes("remove_demo", "Remove the demo feature (template items)? Do it before the first migrate", false))) {
        const { removed, edited } = removeDemo(ROOT);
        say(`Removed the demo: ${removed.length} file(s) deleted, ${edited.length} file(s) edited`);
    }

    // --- launchers ---
    const os = await ask("os", "Create launchers for", IS_WIN ? "windows" : "linux", { choices: ["windows", "linux", "both"] });
    const made = [];
    for (const kind of ["run", "server"]) {
        for (const [target, ext] of [["windows", "bat"], ["linux", "sh"]]) {
            if (os !== target && os !== "both") continue;
            const file = `${kind}_${target}.${ext}`;
            fs.copyFileSync(path.join(ROOT, "scripts", "launchers", file), path.join(ROOT, file));
            if (ext === "sh") fs.chmodSync(path.join(ROOT, file), 0o755);
            made.push(file);
        }
    }
    say(`Created at the repo root: ${made.join(", ")}`);

    // --- extra DB driver ---
    const dialect = config.database.enabled === false ? null : config.database.connection.dialect;
    const drivers = { sqlite: "sqlite3", mysql: "mysql2", mariadb: "mariadb", mssql: "tedious" };
    if (drivers[dialect] && (await yes("install_driver", `Install the ${dialect} driver (${drivers[dialect]}) into Backend?`, true))) {
        if (!runNpm(`install ${drivers[dialect]}`, BACKEND)) throw new Error(`npm install ${drivers[dialect]} failed`);
    }

    // --- install + migrate ---
    if (await yes("install", "Install dependencies now (Backend + Frontend)?", true)) {
        if (!runNode([path.join("scripts", "lib", "tasks.mjs"), "dev"], ROOT)) {
            throw new Error("install / build / migrate failed — see above, fix it, and run the dev launcher again");
        }
    }

    // --- done ---
    const port = config.app.port;
    const startCmd = IS_WIN ? path.join(ROOT, "server_windows.bat") : path.join(ROOT, "server_linux.sh");
    say();
    say("Done.");
    say(`  Dev:     ${IS_WIN ? "run_windows.bat" : "./run_linux.sh"}   → http://${config.app.host === "0.0.0.0" ? "localhost" : config.app.host}:${port}`);
    say(`  Tests:   cd test && npm run test-all   (test instance on ${port + 1})`);
    say(`  Deploy:  scripts/deploy_${IS_WIN ? "windows.bat" : "linux.sh"} (pull, install, build, migrate), then restart the server`);
    say();
    say("OteServerManager — register this app with:");
    say(`  start_command     ${startCmd}`);
    say(`  working_dir       ${ROOT}`);
    say(`  port              from config: port_config_file Backend${path.sep}config.json, port_config_key app.port  (now ${port})`);
    say(`  health            http://127.0.0.1:${port}/api/health`);
    say();
}

try {
    await main();
} catch (err) {
    console.error(`\n  Wizard stopped: ${err.message}\n`);
    process.exitCode = 1;
} finally {
    rl?.close();
}
