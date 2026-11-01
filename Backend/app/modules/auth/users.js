import bcrypt from "bcryptjs";

// Who is signed in, and what may they do. Three account kinds, one shape:
//   root        — config auth.root (bcrypt hash in config.json). Works with no database and
//                 with Oteracount down, so the system can always be managed. Permission "*".
//   local       — db.mst_users row with a password_hash (auth.local_users.enabled).
//   oteracount  — db.mst_users row keyed by oteracount_sub (or, with no database, a session-only
//                 identity with auth.oteracount.default_role). Permissions stay LOCAL to this app.
// A database-backed account is re-read on EVERY request, so disabling it ends access at once
// even though the session cookie itself is stateless (OteRM).

const BCRYPT_ROUNDS = 12;

export const hashPassword = (plain) => bcrypt.hash(String(plain), BCRYPT_ROUNDS);
export const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$.{53}$/.test(value);

// Always run ONE bcrypt compare, even for an unknown user, so response time doesn't
// reveal which usernames exist.
let dummyHash = null; // a real hash of a random value, made on first use
export async function verifyPassword(plain, hash) {
    dummyHash ??= await bcrypt.hash(String(Math.random()), BCRYPT_ROUNDS);
    const ok = await bcrypt.compare(String(plain ?? ""), isBcryptHash(hash) ? hash : dummyHash);
    return ok && isBcryptHash(hash);
}

export function permissionsFor(config, role) {
    if (role === "root") return ["*"];
    return config.auth?.roles?.[role] ?? [];
}

export function can(user, permission) {
    return Boolean(user && (user.permissions.includes("*") || user.permissions.includes(permission)));
}

function publicUser(config, row, kind) {
    return {
        kind,
        uuid: row.uuid ?? null,
        username: row.username ?? null,
        name: row.display_name || row.username || "",
        role: row.role,
        permissions: permissionsFor(config, row.role),
    };
}

export function rootUser(config) {
    const username = config.auth?.root?.username || "root";
    return { kind: "root", uuid: null, username, name: username, role: "root", permissions: ["*"] };
}

// Session identity -> current user (or null if the account is gone / disabled).
export async function resolveUser(config, db, identity) {
    if (!identity) return null;
    if (identity.kind === "root") return config.auth?.root?.enabled === false ? null : rootUser(config);
    if (identity.uuid && db?.mst_users) {
        const row = await db.mst_users.findByPk(identity.uuid);
        return row && row.is_active ? publicUser(config, row, identity.kind) : null;
    }
    // Oteracount sign-in without a database: the identity lives only in the session.
    if (identity.kind === "oteracount" && identity.sub) {
        return { kind: "oteracount", uuid: null, username: null, name: identity.name || "", role: identity.role, permissions: permissionsFor(config, identity.role) };
    }
    return null;
}

// username + password -> session identity, or null. Root first (config), then local users (DB).
export async function checkPassword(config, db, username, password) {
    const root = config.auth?.root ?? {};
    if (root.enabled !== false && username === (root.username || "root")) {
        return (await verifyPassword(password, root.password_hash)) ? { kind: "root" } : null;
    }
    if (config.auth?.local_users?.enabled && db?.mst_users) {
        const row = await db.mst_users.findOne({ where: { username: String(username).toLowerCase() } });
        if (await verifyPassword(password, row?.password_hash)) {
            if (!row.is_active) return null;
            await row.update({ last_login_at: new Date() });
            return { kind: "local", uuid: row.uuid };
        }
        return null;
    }
    await verifyPassword(password, null); // same cost as a real check
    return null;
}

// An Oteracount sign-in: find-or-create the local account by `sub` (if there's a database).
export async function oteracountIdentity(config, db, { sub, claims, userinfo }) {
    const name = userinfo?.name || claims?.name || userinfo?.preferred_username || "";
    const defaultRole = config.auth?.oteracount?.default_role || "user";
    if (!db?.mst_users) return { kind: "oteracount", sub, name, role: defaultRole };

    let row = await db.mst_users.findOne({ where: { oteracount_sub: sub } });
    if (!row) row = await db.mst_users.create({ oteracount_sub: sub, display_name: name, role: defaultRole });
    else await row.update({ display_name: name || row.display_name, last_login_at: new Date() });
    return row.is_active ? { kind: "oteracount", uuid: row.uuid } : null;
}
