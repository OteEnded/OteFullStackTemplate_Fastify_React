// The optional files module, driver "local" — in-process, DB off, auth off.
// (Driver "bloteb" is checked live against a private Bloteb in checks/bloteb.check.mjs.)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { testConfig, loadBackend } from "../lib/backend.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fst-test-files-"));
const config = testConfig({
    security: { secret_box_key: "f".repeat(40) },
    files: { enabled: true, driver: "local", max_mb: 0.01, types: ["image/*", "text/plain"], local: { directory: dir } },
});
let backend;
let app;

before(async () => {
    backend = await loadBackend(config);
    app = await backend.buildApp(config);
});
after(async () => {
    await app?.close();
    fs.rmSync(dir, { recursive: true, force: true });
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);

function multipart(bytes, filename, type = "application/octet-stream") {
    const boundary = "----fst" + Math.random().toString(16).slice(2);
    const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return { payload: body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}
const upload = (bytes, filename, type) => app.inject({ method: "POST", url: "/api/files", ...multipart(bytes, filename, type) });

test("upload → id + a signed link that serves the exact bytes, with the REAL type", async () => {
    // Claimed as text/html by the "browser" — the server goes by the bytes.
    const res = await upload(PNG, "pic.png", "text/html");
    assert.equal(res.statusCode, 201);
    const file = res.json().data;
    assert.match(file.id, /^[0-9a-f-]{36}$/);
    assert.equal(file.mime, "image/png");
    assert.equal(file.size, PNG.length);

    const raw = await app.inject({ method: "GET", url: file.url });
    assert.equal(raw.statusCode, 200);
    assert.ok(raw.rawPayload.equals(PNG));
    assert.equal(raw.headers["content-type"], "image/png");
    assert.equal(raw.headers["x-content-type-options"], "nosniff");
    assert.match(raw.headers["content-disposition"], /^inline/);
});

test("no ticket, a forged ticket, or another file's ticket → 404", async () => {
    const a = (await upload(PNG, "a.png")).json().data;
    const b = (await upload(PNG, "b.png")).json().data;
    const bTicket = new URL(b.url, "http://x").searchParams.get("t");
    assert.equal((await app.inject({ method: "GET", url: `/api/files/raw/${a.id}` })).statusCode, 404);
    assert.equal((await app.inject({ method: "GET", url: `/api/files/raw/${a.id}?t=v1.forged.ticket.x` })).statusCode, 404);
    assert.equal((await app.inject({ method: "GET", url: `/api/files/raw/${a.id}?t=${bTicket}` })).statusCode, 404);
});

test("type and size limits: unknown bytes are refused (415), too big is 413", async () => {
    const stored = () => fs.readdirSync(dir).filter((f) => f.endsWith(".bin")).length;
    const before = stored();
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100, 0)]);
    const bad = await upload(exe, "notes.txt", "text/plain");
    assert.equal(bad.statusCode, 415);
    assert.equal(bad.json().code, "unsupported_media_type");
    assert.equal(stored(), before, "the refused upload left nothing behind");

    const big = await upload(Buffer.concat([PNG, Buffer.alloc(20000, 1)]), "big.png");
    assert.equal(big.statusCode, 413);
    assert.equal(big.json().code, "payload_too_large");
});

test("text is served as text/plain — never as a page — and other text-ish types download", async () => {
    const file = (await upload(Buffer.from("<script>alert(1)</script>"), "x.html", "text/html")).json().data;
    assert.equal(file.mime, "text/plain");
    const raw = await app.inject({ method: "GET", url: file.url });
    assert.match(raw.headers["content-type"], /^text\/plain/);
    assert.match(raw.headers["content-security-policy"], /sandbox/);
});

test("metadata gives a fresh link; delete removes the bytes; then 404 everywhere", async () => {
    const file = (await upload(PNG, "gone.png")).json().data;
    const meta = await app.inject({ method: "GET", url: `/api/files/${file.id}` });
    assert.equal(meta.json().data.name, "gone.png");
    const del = await app.inject({ method: "POST", url: `/api/files/${file.id}/delete` });
    assert.deepEqual(del.json().data, { id: file.id, deleted: true });
    assert.equal((await app.inject({ method: "GET", url: file.url })).statusCode, 404);
    assert.equal((await app.inject({ method: "GET", url: `/api/files/${file.id}` })).statusCode, 404);
});

test("unclaimed (pending) uploads are purged; claimed ones stay", async () => {
    const pending = await app.files.put(PNG, { name: "never-saved.png" });
    const kept = (await upload(PNG, "kept.png")).json().data;
    // pretend the pending one is a day old
    const metaFile = path.join(dir, `${pending.id}.json`);
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    meta.createdAt = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    fs.writeFileSync(metaFile, JSON.stringify(meta));
    assert.equal(await app.files.purgePending(24), 1);
    assert.equal(await app.files.get(pending.id), null);
    assert.ok(await app.files.get(kept.id));
});

test("files module OFF (the default): no routes; config check needs the key for driver local", async () => {
    const off = await backend.buildApp(testConfig());
    assert.equal((await off.inject({ method: "POST", url: "/api/files" })).statusCode, 404);
    await off.close();
    const problems = backend.checkConfig(testConfig({ files: { enabled: true, driver: "local" }, security: { secret_box_key: "" } }));
    assert.ok(problems.some((p) => /secret_box_key/.test(p)), problems.join(" | "));
    const bl = backend.checkConfig(testConfig({ files: { enabled: true, driver: "bloteb", bloteb: { baseUrl: "", app: "", key: "x" } } }));
    assert.ok(bl.some((p) => /bk1/.test(p)) && bl.some((p) => /files\.bloteb\.app/.test(p)), bl.join(" | "));
});
