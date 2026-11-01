// Auth admin from the terminal (no web UI needed to bootstrap).
//
//   npm run auth:hash-password -- <password>            print a bcrypt hash for auth.root.password_hash
//   npm run auth:user -- list
//   npm run auth:user -- add <username> <password> [role]
//   npm run auth:user -- set-password <username> <password>
//   npm run auth:user -- set-role <username> <role>
//   npm run auth:user -- disable <username>   |   enable <username>
//   (any command: --config <file> to target another config)
//
// Local users need the database + migration 003 (`npm run db:migrate`).

import { loadConfig } from "../../../lib/utility.js";
import { hashPassword } from "./users.js";

const args = process.argv.slice(2);
const configAt = args.indexOf("--config");
const configPath = configAt >= 0 ? args.splice(configAt, 2)[1] : undefined;
const [command, ...rest] = args;

function usage(message) {
    if (message) console.error(`auth: ${message}`);
    console.error("usage: hash-password <password> | list | add <username> <password> [role] | set-password <u> <p> | set-role <u> <role> | disable <u> | enable <u>");
    process.exit(2);
}

if (command === "hash-password") {
    if (!rest[0]) usage("give the password as an argument");
    if (rest[0].length < 10) console.error("auth: warning — that password is short (under 10 characters)");
    console.log(await hashPassword(rest[0]));
    process.exit(0);
}

const config = loadConfig(configPath);
const { initDB } = await import("../../../database/index.js");
let db;
let exitCode = 0;
try {
    db = await initDB();
    const users = db.mst_users;
    const find = async (username) => {
        const row = await users.findOne({ where: { username: String(username ?? "").toLowerCase() } });
        if (!row) throw new Error(`no user "${username}"`);
        return row;
    };
    const roles = Object.keys(config.auth?.roles ?? {});
    const checkRole = (role) => {
        if (!roles.includes(role)) throw new Error(`unknown role "${role}" — config auth.roles has: ${roles.join(", ")}`);
        return role;
    };

    switch (command) {
        case "list":
            for (const u of await users.findAll({ order: [["rolling_id", "ASC"]] })) {
                console.log(`${String(u.rolling_id).padStart(4)}  ${(u.username ?? "(oteracount)").padEnd(20)} ${u.role.padEnd(10)} ${u.is_active ? "active  " : "DISABLED"} ${u.oteracount_sub ? `oteracount:${u.oteracount_sub}` : "local"}`);
            }
            break;
        case "add": {
            const [username, password, role = "user"] = rest;
            if (!username || !password) usage("add needs <username> <password>");
            await users.create({ username: username.toLowerCase(), display_name: username, password_hash: await hashPassword(password), role: checkRole(role) });
            console.log(`added ${username.toLowerCase()} (${role})`);
            break;
        }
        case "set-password":
            if (!rest[1]) usage("set-password needs <username> <password>");
            await (await find(rest[0])).update({ password_hash: await hashPassword(rest[1]) });
            console.log(`password changed for ${rest[0]}`);
            break;
        case "set-role":
            await (await find(rest[0])).update({ role: checkRole(rest[1]) });
            console.log(`${rest[0]} is now ${rest[1]}`);
            break;
        case "disable":
        case "enable":
            await (await find(rest[0])).update({ is_active: command === "enable" });
            console.log(`${rest[0]} ${command}d`);
            break;
        default:
            usage(command ? `unknown command "${command}"` : "");
    }
} catch (err) {
    console.error(`auth: ${err.message}`);
    exitCode = 1;
} finally {
    await db?.sequelize.close().catch(() => {});
}
process.exit(exitCode);
