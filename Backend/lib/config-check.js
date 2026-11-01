// Boot-time config guard. Collects EVERY problem and returns them together, so a
// misconfigured server refuses to start with one complete list instead of failing
// on the first problem, then the next, then the next (Otenization, OteRM).
//
// Add a check here whenever a value would make the app unsafe or silently broken.

import { getDbConfig } from "./db-config.js";

const PLACEHOLDER = /CHANGE_ME/i;

function walk(value, path, visit) {
    visit(value, path);
    if (value && typeof value === "object") {
        for (const [key, inner] of Object.entries(value)) {
            if (key === "_comments") continue;
            walk(inner, path ? `${path}.${key}` : key, visit);
        }
    }
}

function isHttpOrigin(value) {
    try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && url.pathname === "/" && !url.search;
    } catch {
        return false;
    }
}

export function checkConfig(config) {
    const problems = [];
    const app = config?.app ?? {};

    // Placeholders anywhere (secrets, passwords, ids) mean "never filled in".
    walk(config, "", (value, path) => {
        if (typeof value === "string" && PLACEHOLDER.test(value)) {
            problems.push(`${path} still holds a placeholder ("${value}") — set a real value`);
        }
    });

    if (!Number.isInteger(app.port) || app.port < 1 || app.port > 65535) {
        problems.push(`app.port must be an integer 1–65535 (got ${JSON.stringify(app.port)})`);
    }
    if (app.host !== undefined && (typeof app.host !== "string" || !app.host.trim())) {
        problems.push(`app.host must be a non-empty string such as "127.0.0.1" or "0.0.0.0"`);
    }
    if (app.public_origins !== undefined) {
        if (!Array.isArray(app.public_origins)) {
            problems.push(`app.public_origins must be an array of origins like "https://app.example.com"`);
        } else {
            for (const origin of app.public_origins) {
                if (origin === "*") {
                    problems.push(`app.public_origins must not contain "*" — list the real origins`);
                } else if (!isHttpOrigin(origin)) {
                    problems.push(`app.public_origins: "${origin}" is not an origin (scheme://host[:port], no path)`);
                }
            }
        }
    }
    if (app.trust_proxy !== undefined) {
        const tp = app.trust_proxy;
        const ok = typeof tp === "boolean" || Number.isInteger(tp) || typeof tp === "string"
            || (Array.isArray(tp) && tp.every((entry) => typeof entry === "string"));
        if (!ok) problems.push(`app.trust_proxy must be false, a hop count, an address/CIDR, or a list of them`);
        if (tp === true) {
            problems.push(`app.trust_proxy: true trusts ANY client's X-Forwarded-For — use the proxy's address (e.g. "127.0.0.1") or a hop count`);
        }
    }
    if (app.body_limit_mb !== undefined && !(typeof app.body_limit_mb === "number" && app.body_limit_mb > 0)) {
        problems.push(`app.body_limit_mb must be a positive number (megabytes)`);
    }

    // Database settings: the same rules the DB layer itself enforces (lib/db-config.js).
    if (config?.database?.enabled !== false) {
        try {
            getDbConfig(config);
        } catch (err) {
            problems.push(...(err.problems ?? [err.message]).map((p) => `${p} (database.enabled is on)`));
        }
    }

    return problems;
}
