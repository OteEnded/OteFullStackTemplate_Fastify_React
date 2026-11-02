// COPIED VERBATIM from C:\data\Otenization\Bloteb\Client\bloteb-client.js (Bloteb e22ebe4, 2026-11-02).
// Don't edit here — re-copy when Bloteb announces a client change (GUIDE_Bloteb_for_apps.md §5).
// Used by app/modules/files (driver "bloteb").
// bloteb-client.js — the one file an Ote app copies to use Bloteb (Node 18+, ESM, no dependencies).
// Guide: c:\data\Otenization\Reference\docs\GUIDE_Bloteb_for_apps.md
//
//   import { createBlotebClient } from "./bloteb-client.js";
//   const bloteb = createBlotebClient({
//       baseUrl: "https://files.otenization.com",     // what BROWSERS use (readUrl, publicUrl, uploadTicket)
//       internalBaseUrl: "http://127.0.0.1:8070",     // optional: what YOUR BACKEND uses when it runs on Bloteb's box
//       app: "osm", privateKey: config.bloteb.key });
//
//   // 1. a browser upload: hand the page a one-time upload URL, it POSTs multipart/form-data (field "file") there
//   const { url } = bloteb.uploadTicket({ ownerSub: user.sub, types: ["image/*"], maxBytes: 5_000_000 });
//   // 2. the page sends back the id Bloteb returned; YOUR backend claims it once it is saved on your record
//   await bloteb.claim(id);
//   // 3. show it: a short-lived URL, signed locally (no request to Bloteb)
//   const src = bloteb.readUrl(id);
//   // 4. your backend needs the bytes itself (e.g. to send an image to a model): fetchBytes(id) → { bytes, mime }
//
// The private key (bk1.…) never leaves your backend. Your app decides who may see what; Bloteb only checks tickets.
import { createHash, createPrivateKey, randomBytes, sign } from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");

export function createBlotebClient({ baseUrl, internalBaseUrl, app, privateKey, fetch: fetchImpl = globalThis.fetch }) {
    if (!baseUrl || !app || !privateKey) throw new Error("bloteb: baseUrl, app and privateKey are required");
    if (!privateKey.startsWith("bk1.")) throw new Error("bloteb: privateKey must be the bk1.… key printed when the app was registered");
    const base = baseUrl.replace(/\/+$/, "");
    // Backend-to-Bloteb calls (api, server uploads, fetchBytes) go here; browser-facing URLs always use `base`.
    const inner = (internalBaseUrl || baseUrl).replace(/\/+$/, "");
    const key = createPrivateKey({ key: Buffer.from(privateKey.slice(4), "base64url"), format: "der", type: "pkcs8" });
    const now = () => Math.floor(Date.now() / 1000);

    function ticket(payload) {
        const body = b64u(JSON.stringify({ v: 1, app, ...payload }));
        return `${body}.${b64u(sign(null, Buffer.from(body), key))}`;
    }

    // Read URLs expire on a time grid (`bucket` seconds), so the same file gets the same URL for a while and
    // browsers can cache it. Defaults: valid 50–60 min, a new URL every 10 min.
    // name (optional): the file's name, appended to the URL so the browser tab shows it. Cosmetic; never checked.
    const tail = (name) => (name ? `/${encodeURIComponent(String(name).replace(/[\\/]/g, "_")).slice(0, 200)}` : "");

    function readUrl(id, { ttl = 3600, bucket = 600, internal = false, name } = {}) {
        const t = now();
        let exp = Math.floor((t + ttl) / bucket) * bucket;
        if (exp <= t + 60) exp = t + ttl;
        return `${internal ? inner : base}/f/${id}${tail(name)}?t=${ticket({ op: "r", b: id, exp })}`;
    }

    // The bytes of a blob, for your backend (model replay, exports). Reads through the internal base.
    // Throws with .status (404 not found/deleted, 503 storage offline) — callers decide the fallback.
    async function fetchBytes(id) {
        const res = await fetchImpl(readUrl(id, { ttl: 300, bucket: 60, internal: true }));
        if (!res.ok) throw Object.assign(new Error(`bloteb fetchBytes ${id}: HTTP ${res.status}`), { status: res.status });
        return { bytes: Buffer.from(await res.arrayBuffer()), mime: (res.headers.get("content-type") || "").split(";")[0] };
    }

    function publicUrl(id, { name } = {}) {
        return `${base}/p/${app}/${id}${tail(name)}`;
    }

    // One upload = one ticket (single use). The file arrives PENDING: claim it, or it is deleted after the pending TTL.
    function uploadTicket({ ownerSub, maxBytes, types, visibility, meta, ttl = 900 } = {}) {
        const jti = b64u(randomBytes(16));
        const exp = now() + ttl;
        const payload = { op: "w", jti, exp };
        if (ownerSub) payload.own = String(ownerSub);
        if (maxBytes) payload.max = maxBytes;
        if (types) payload.types = types;
        if (visibility) payload.vis = visibility;
        if (meta) payload.meta = meta;
        return { url: `${base}/u?t=${ticket(payload)}`, jti, expiresAt: new Date(exp * 1000) };
    }

    async function apiRaw(method, path, body) {
        const raw = body === undefined ? undefined : JSON.stringify(body);
        const payload = { op: "api", m: method, p: path, exp: now() + 50, jti: b64u(randomBytes(9)) };
        if (raw !== undefined) payload.h = createHash("sha256").update(raw).digest("base64url");
        const res = await fetchImpl(`${inner}${path}`, {
            method,
            headers: { authorization: `Ote-Blob ${ticket(payload)}`, ...(raw !== undefined ? { "content-type": "application/json" } : {}) },
            body: raw,
        });
        const json = await res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }));
        if (!res.ok || !json.ok) throw Object.assign(new Error(`bloteb ${method} ${path}: ${json.message || res.status}`), { status: res.status, body: json });
        return json;
    }
    const api = async (method, path, body) => (await apiRaw(method, path, body)).data;

    const enc = encodeURIComponent;
    return {
        readUrl,
        publicUrl,
        uploadTicket,
        fetchBytes,
        get: (id) => api("GET", `/api/v1/blobs/${enc(id)}`),
        // This app's blobs, paged: { data: [...], next } — pass next back as `after` until it is null.
        async list({ state, after, limit } = {}) {
            const qs = new URLSearchParams();
            if (state) qs.set("state", state);
            if (after) qs.set("after", after);
            if (limit) qs.set("limit", String(limit));
            return apiRaw("GET", `/api/v1/blobs${qs.size ? `?${qs}` : ""}`);
        },
        claim: (id, { visibility, meta } = {}) => api("POST", `/api/v1/blobs/${enc(id)}/claim`, { visibility, meta }),
        update: (id, changes) => api("PATCH", `/api/v1/blobs/${enc(id)}`, changes),
        remove: (id) => api("DELETE", `/api/v1/blobs/${enc(id)}`),
        usage: () => api("GET", "/api/v1/usage"),

        // Upload from your backend (generated reports, imports). `data` = Buffer, string or a stream (pass
        // contentLength with a stream). Arrives ACTIVE unless state: "pending".
        async uploadFromServer(data, { name, owner, visibility, state, contentLength } = {}) {
            const qs = new URLSearchParams();
            if (name) qs.set("name", name);
            if (owner) qs.set("owner", owner);
            if (visibility) qs.set("visibility", visibility);
            if (state) qs.set("state", state);
            const path = `/api/v1/blobs${qs.size ? `?${qs}` : ""}`;
            const payload = { op: "api", m: "PUT", p: path, exp: now() + 50, jti: b64u(randomBytes(9)) };
            const headers = { authorization: `Ote-Blob ${ticket(payload)}`, "content-type": "application/octet-stream" };
            if (contentLength != null) headers["content-length"] = String(contentLength);
            const isStream = data && typeof data.pipe === "function";
            const res = await fetchImpl(`${inner}${path}`, { method: "PUT", headers, body: data, ...(isStream ? { duplex: "half" } : {}) });
            const json = await res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }));
            if (!res.ok || !json.ok) throw Object.assign(new Error(`bloteb PUT: ${json.message || res.status}`), { status: res.status, body: json });
            return json.data;
        },
    };
}
