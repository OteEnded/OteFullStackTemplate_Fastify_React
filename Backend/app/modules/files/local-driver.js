import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { makeBox } from "../../../lib/crypto-box.js";

// Driver "local": files in a folder (files.local.directory), metadata in a .json beside each
// file — no database needed. Same contract as the Bloteb driver: put (pending) → claim → url /
// bytes / remove. Read URLs are short-lived signed tickets (like Bloteb's), served by
// GET /api/files/raw/:id?t=… — the ticket IS the permission, so links can go in <img src>.

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ID = /^[0-9a-f-]{36}$/;

// The REAL type comes from the bytes, never from the name or the browser's claim (Bloteb's rule).
// Anything not recognised is application/octet-stream and is always served as a download.
const SIGNATURES = [
    ["image/png", (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47],
    ["image/jpeg", (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
    ["image/gif", (b) => b.length > 6 && b.toString("ascii", 0, 4) === "GIF8"],
    ["image/webp", (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"],
    ["application/pdf", (b) => b.length > 5 && b.toString("ascii", 0, 5) === "%PDF-"],
];
export function sniffType(bytes) {
    for (const [type, test] of SIGNATURES) if (test(bytes)) return type;
    // Plain text (UTF-8, no NULs) is served as text/plain — never as HTML.
    const head = bytes.subarray(0, 4096);
    if (!head.includes(0) && Buffer.from(head.toString("utf8"), "utf8").equals(head)) return "text/plain";
    return "application/octet-stream";
}

export function createLocalDriver(config) {
    const dir = path.resolve(backendRoot, config.files?.local?.directory || "./data/files");
    fs.mkdirSync(dir, { recursive: true });
    const box = makeBox(config.security?.secret_box_key, "files");
    const metaPath = (id) => path.join(dir, `${id}.json`);
    const dataPath = (id) => path.join(dir, `${id}.bin`);
    const readMeta = (id) => {
        if (!ID.test(id) || !fs.existsSync(metaPath(id))) return null;
        return JSON.parse(fs.readFileSync(metaPath(id), "utf8"));
    };

    return {
        name: "local",
        async put(bytes, { name = "file", owner = null } = {}) {
            const id = crypto.randomUUID();
            const meta = {
                id,
                name: String(name).slice(0, 200),
                mime: sniffType(bytes),
                size: bytes.length,
                sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
                owner,
                state: "pending",
                createdAt: new Date().toISOString(),
            };
            fs.writeFileSync(dataPath(id), bytes);
            fs.writeFileSync(metaPath(id), JSON.stringify(meta));
            return meta;
        },
        async claim(id) {
            const meta = readMeta(id);
            if (!meta) throw Object.assign(new Error("file not found"), { status: 404 });
            meta.state = "active";
            fs.writeFileSync(metaPath(id), JSON.stringify(meta));
            return meta;
        },
        async get(id) {
            return readMeta(id);
        },
        url(id, { name, ttlSeconds = 3600 } = {}) {
            const token = box.seal({ id, exp: Date.now() + ttlSeconds * 1000 });
            const tail = name ? `/${encodeURIComponent(String(name).replace(/[\\/]/g, "_"))}` : "";
            return `/api/files/raw/${id}${tail}?t=${token}`;
        },
        // For the raw route: the id the ticket grants, or null (forged / expired / for another file).
        checkTicket(id, token) {
            const t = box.open(token);
            return t && t.id === id && t.exp > Date.now() ? readMeta(id) : null;
        },
        async bytes(id) {
            const meta = readMeta(id);
            if (!meta) throw Object.assign(new Error("file not found"), { status: 404 });
            return { bytes: fs.readFileSync(dataPath(id)), mime: meta.mime };
        },
        stream(id) {
            return fs.createReadStream(dataPath(id));
        },
        async remove(id) {
            const meta = readMeta(id);
            if (!meta) return false;
            fs.rmSync(dataPath(id), { force: true });
            fs.rmSync(metaPath(id), { force: true });
            return true;
        },
        // Pending files never claimed (the caller's save failed) — deleted after `hours`.
        async purgePending(hours = 24) {
            let removed = 0;
            for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
                const meta = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
                if (meta.state === "pending" && Date.parse(meta.createdAt) < Date.now() - hours * 3600 * 1000) {
                    await this.remove(meta.id);
                    removed++;
                }
            }
            return removed;
        },
    };
}
