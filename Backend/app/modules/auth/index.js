import fp from "fastify-plugin";
import fastifyCookie from "@fastify/cookie";
import { log } from "../../../lib/utility.js";
import { makeSessionStore } from "./session.js";
import { makeLimiter } from "./rate-limit.js";
import { makeBox } from "../../../lib/crypto-box.js";
import { can, checkPassword, oteracountIdentity, resolveUser } from "./users.js";
import * as oteracount from "./oteracount.js";

// OPTIONAL AUTH MODULE — off unless config auth.enabled. Removable: delete this folder,
// its register line in app.js, the "auth" config block, migration 003 + mst_users model.
//
// Sign-in methods (each switchable in config.json → auth):
//   root        auth.root (username + bcrypt password_hash) — always works, no DB needed
//   local       auth.local_users.enabled — accounts in db.mst_users (npm run auth:user)
//   oteracount  auth.oteracount.enabled — "Login with Oteracount" (OIDC)
//
// Routes (GET + POST only):
//   GET  /api/auth/me                      { enabled, user, methods }
//   POST /api/auth/login                   { username, password }
//   POST /api/auth/logout                  -> { redirect? } (Oteracount end-session URL)
//   GET  /api/auth/oteracount/start        -> 302 to Oteracount
//   GET  /api/auth/oteracount/callback     <- Oteracount; -> 302 to /console (or /login?error=…)
//
// For routes:  { onRequest: fastify.requireSignedIn }  or  { onRequest: fastify.requirePermission("items.write") }
// Both are no-ops while auth is off, so routes can use them unconditionally.
// request.user is the signed-in user (or null) after either has run.

export default fp(async function auth(fastify) {
    const config = fastify.config;
    const enabled = config.auth?.enabled === true;
    fastify.decorateRequest("user", null);

    if (!enabled) {
        const noop = async () => {};
        fastify.decorate("requireSignedIn", noop);
        fastify.decorate("requirePermission", () => noop);
        fastify.get("/api/auth/me", async () => ({ ok: true, data: { enabled: false, user: null, methods: {} } }));
        return;
    }

    await fastify.register(fastifyCookie);
    const sessions = makeSessionStore(config);
    const flowBox = makeBox(config.auth.session.secret, "oteracount-flow");
    const flowCookie = `${sessions.name}_oac`;
    const limits = config.auth.rate_limit ?? {};
    const windowMs = (limits.window_minutes ?? 15) * 60 * 1000;
    const perAccount = makeLimiter({ maxFailures: limits.max_failures ?? 8, windowMs });
    const perIp = makeLimiter({ maxFailures: (limits.max_failures ?? 8) * 4, windowMs });

    const methods = {
        password: config.auth.root?.enabled !== false || Boolean(config.auth.local_users?.enabled),
        oteracount: oteracount.isConfigured(config),
    };

    async function currentUser(request) {
        if (request.user) return request.user;
        request.user = await resolveUser(config, fastify.db, sessions.read(request));
        return request.user;
    }

    const notSignedIn = (reply) => reply.code(401).send({ ok: false, message: "Sign-in required", code: "not_signed_in" });

    fastify.decorate("requireSignedIn", async (request, reply) => {
        if (!(await currentUser(request))) return notSignedIn(reply);
    });
    fastify.decorate("requirePermission", (permission) => async (request, reply) => {
        const user = await currentUser(request);
        if (!user) return notSignedIn(reply);
        if (!can(user, permission)) {
            return reply.code(403).send({ ok: false, message: `Missing permission: ${permission}`, code: "forbidden" });
        }
    });

    fastify.get("/api/auth/me", async (request) => {
        return { ok: true, data: { enabled: true, user: await currentUser(request), methods } };
    });

    fastify.post("/api/auth/login", {
        schema: {
            body: {
                type: "object",
                required: ["username", "password"],
                properties: { username: { type: "string", minLength: 1, maxLength: 100 }, password: { type: "string", minLength: 1, maxLength: 200 } },
            },
        },
    }, async (request, reply) => {
        const username = request.body.username.trim().toLowerCase();
        const accountKey = `${request.ip}|${username}`;
        for (const [limiter, key] of [[perAccount, accountKey], [perIp, request.ip]]) {
            const state = limiter.check(key);
            if (state.limited) {
                reply.header("retry-after", String(state.retryAfterSeconds));
                return reply.code(429).send({ ok: false, message: `Too many failed sign-ins — try again in ${state.retryAfterSeconds} s`, code: "too_many_attempts" });
            }
        }

        const identity = await checkPassword(config, fastify.db, username, request.body.password);
        if (!identity) {
            perAccount.recordFailure(accountKey);
            perIp.recordFailure(request.ip);
            await log.warning(`Failed sign-in for "${username}" from ${request.ip}`, import.meta.url);
            return reply.code(401).send({ ok: false, message: "Wrong username or password", code: "invalid_credentials" });
        }

        perAccount.clear(accountKey);
        sessions.write(request, reply, identity);
        const user = await resolveUser(config, fastify.db, identity);
        await log(`Signed in: ${user.username || user.name} (${user.kind}) from ${request.ip}`, import.meta.url);
        return { ok: true, data: { user } };
    });

    fastify.post("/api/auth/logout", async (request, reply) => {
        const identity = sessions.read(request);
        sessions.clear(request, reply);
        let redirect = null;
        if (identity?.kind === "oteracount" && identity.idToken && config.auth.oteracount?.postLogoutRedirectUri) {
            try {
                redirect = await oteracount.endSessionUrl(config, identity.idToken);
            } catch {
                redirect = null; // Oteracount unreachable — the local sign-out still happened
            }
        }
        return { ok: true, data: { redirect } };
    });

    if (methods.oteracount) {
        fastify.get("/api/auth/oteracount/start", async (request, reply) => {
            const { url, flow } = await oteracount.startLogin(config);
            reply.setCookie(flowCookie, flowBox.seal({ ...flow, exp: Date.now() + 10 * 60 * 1000 }), {
                path: "/api/auth/oteracount", httpOnly: true, sameSite: "lax", secure: request.protocol === "https", maxAge: 600,
            });
            return reply.redirect(url.href);
        });

        fastify.get("/api/auth/oteracount/callback", async (request, reply) => {
            const flow = flowBox.open(request.cookies[flowCookie]);
            reply.clearCookie(flowCookie, { path: "/api/auth/oteracount" });
            if (!flow || flow.exp < Date.now()) return reply.redirect("/login?error=oteracount_expired");
            try {
                const result = await oteracount.finishLogin(config, request.raw.url, flow);
                const identity = await oteracountIdentity(config, fastify.db, result);
                if (!identity) return reply.redirect("/login?error=account_disabled");
                sessions.write(request, reply, { ...identity, idToken: result.idToken });
                await log(`Signed in with Oteracount: sub ${result.sub} from ${request.ip}`, import.meta.url);
                return reply.redirect("/console");
            } catch (err) {
                await log.warning(`Oteracount sign-in failed: ${err.message}`, import.meta.url);
                return reply.redirect("/login?error=oteracount");
            }
        });
    }

    await log(`Auth enabled: ${[methods.password && "password", methods.oteracount && "oteracount"].filter(Boolean).join(" + ") || "no sign-in method!"}`, import.meta.url);
});
