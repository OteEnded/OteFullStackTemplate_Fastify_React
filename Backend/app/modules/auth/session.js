import { makeBox } from "../../../lib/crypto-box.js";

// The session is a SEALED cookie (AES-256-GCM via lib/crypto-box.js): the server keeps
// no session store, the browser can't read or forge it, and the expiry inside it is
// checked on every request. No native module (see crypto-box.js).
//
// ⚠ The cookie NAME is per app (auth.session.cookie_name, default "<app.slug>_session"):
// cookies are not port-scoped, so two apps on one host sharing a name log each other
// out — EnterpriseAgentPlatform and OteLLMServices did exactly that.

export function cookieName(config) {
    return config.auth?.session?.cookie_name || `${config.app?.slug || "app"}_session`;
}

export function makeSessionStore(config) {
    const s = config.auth?.session ?? {};
    const box = makeBox(s.secret, "session");
    const maxAgeSeconds = Math.round((s.max_age_hours ?? 12) * 3600);
    const name = cookieName(config);

    const cookieOptions = (request) => ({
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        // "auto": Secure only when the request really came over https (needs app.trust_proxy
        // behind a TLS-terminating proxy, or request.protocol stays "http").
        secure: s.secure === "auto" || s.secure === undefined ? request.protocol === "https" : Boolean(s.secure),
    });

    return {
        name,
        read(request) {
            const raw = request.cookies?.[name];
            if (!raw) return null;
            const data = box.open(raw);
            if (!data || typeof data.exp !== "number" || data.exp < Date.now()) return null;
            return data;
        },
        write(request, reply, identity) {
            const data = { ...identity, exp: Date.now() + maxAgeSeconds * 1000 };
            reply.setCookie(name, box.seal(data), { ...cookieOptions(request), maxAge: maxAgeSeconds });
        },
        clear(request, reply) {
            reply.clearCookie(name, cookieOptions(request));
        },
    };
}
