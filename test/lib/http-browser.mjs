// A tiny scripted "browser" for redirect flows (OIDC sign-in), adapted from Oteracount's
// test/lib/browser.mjs. Faithful where these flows depend on it:
//  · cookies are keyed by HOST only, not port — like a real browser, so two apps on one
//    host (127.0.0.1:8081 + 127.0.0.1:8082) share a jar and cookie-name clashes show up;
//  · cookies honour Path; Max-Age=0 / past Expires delete;
//  · redirects are followed by hand, so every hop can be inspected or stopped at.

export class HttpBrowser {
    constructor() {
        this.jar = new Map(); // `${host}|${path}|${name}` -> { host, path, name, value }
        this.trail = [];
    }

    #store(url, setCookies) {
        for (const line of setCookies) {
            const [pair, ...attrs] = line.split(";").map((s) => s.trim());
            const eq = pair.indexOf("=");
            const name = pair.slice(0, eq);
            const value = pair.slice(eq + 1);
            let path = "/";
            let expired = false;
            for (const attr of attrs) {
                const [k, v = ""] = attr.split("=");
                const key = k.toLowerCase();
                if (key === "path") path = v || "/";
                if (key === "max-age" && Number(v) <= 0) expired = true;
                if (key === "expires" && Date.parse(v) < Date.now()) expired = true;
            }
            const id = `${url.hostname}|${path}|${name}`;
            if (expired) this.jar.delete(id);
            else this.jar.set(id, { host: url.hostname, path, name, value });
        }
    }

    cookieHeader(url) {
        return [...this.jar.values()]
            .filter((c) => c.host === url.hostname && (url.pathname === c.path || url.pathname.startsWith(c.path.endsWith("/") ? c.path : `${c.path}/`)))
            .sort((a, b) => b.path.length - a.path.length)
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");
    }

    // One hop; never follows redirects.
    async request(href, { method = "GET", headers = {}, body } = {}) {
        const url = new URL(href);
        this.trail.push(`${method} ${url.href}`);
        const cookie = this.cookieHeader(url);
        const res = await fetch(url, { method, redirect: "manual", headers: { ...(cookie ? { cookie } : {}), ...headers }, body });
        this.#store(url, res.headers.getSetCookie());
        const text = await res.text();
        let json = null;
        try {
            json = JSON.parse(text);
        } catch {
            json = null;
        }
        const location = res.headers.get("location");
        return { url, status: res.status, text, json, location: location ? new URL(location, url).href : null, headers: res.headers };
    }

    postJson(href, body, headers = {}) {
        return this.request(href, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    }

    postForm(href, fields, headers = {}) {
        return this.request(href, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams(fields).toString() });
    }

    // Follow redirects until a non-redirect, or until stopAt(url) is true (that URL is NOT requested).
    async go(href, { stopAt, max = 20 } = {}) {
        let next = href;
        for (let i = 0; i < max; i++) {
            if (stopAt?.(new URL(next))) return { stoppedAt: next };
            const res = await this.request(next);
            if (res.status >= 300 && res.status < 400 && res.location) {
                next = res.location;
                continue;
            }
            return res;
        }
        throw new Error(`too many redirects from ${href}`);
    }
}
