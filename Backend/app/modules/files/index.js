import fp from "fastify-plugin";
import multipart from "@fastify/multipart";
import { log } from "../../../lib/utility.js";
import { createLocalDriver } from "./local-driver.js";
import { createBlotebDriver } from "./bloteb-driver.js";

// OPTIONAL FILES MODULE (uploads) — off unless config files.enabled. Ote: "an uploads helper
// interesting. we have bloteb as a service as options" → ONE interface, two drivers:
//   files.driver "local"   files in a folder, signed short-lived links (no other service needed)
//   files.driver "bloteb"  files in Bloteb (GUIDE_Bloteb_for_apps.md) — the same calls
//
// In your feature, store only the file id in your row:
//   const file = await fastify.files.put(bytes, { name, owner })   // arrives PENDING
//   await saveYourRow({ file_id: file.id })                          // if this throws, the file is purged later
//   await fastify.files.claim(file.id)
//   const src = fastify.files.url(file.id, { name })                 // per response, after YOUR access check
//
// Routes (GET + POST only):
//   POST /api/files                 multipart field "file" → { id, name, mime, size, url } (put + claim)
//   GET  /api/files/:id             metadata + a fresh url (owner or "files.admin")
//   POST /api/files/:id/delete      delete (owner or "files.admin")
//   GET  /api/files/raw/:id[/name]?t=…   the bytes — driver "local" only; the ticket is the permission
// Removable: delete this folder, its register line in app.js and the "files" config block.

const INLINE = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)$/;

function typeAllowed(mime, allowed) {
    if (!allowed?.length) return true;
    return allowed.some((rule) => rule === mime || (rule.endsWith("/*") && mime.startsWith(rule.slice(0, -1))));
}

export default fp(async function files(fastify) {
    const cfg = fastify.config.files;
    if (!cfg?.enabled) return;

    const driver = cfg.driver === "bloteb" ? createBlotebDriver(fastify.config) : createLocalDriver(fastify.config);
    const maxBytes = Math.round((cfg.max_mb ?? 10) * 1024 * 1024);
    fastify.decorate("files", driver);
    await fastify.register(multipart, { limits: { fileSize: maxBytes, files: 1 } });

    const ownerOf = (request) => request.user?.uuid ?? request.user?.username ?? null;
    const mayAccess = (request, meta) =>
        !fastify.config.auth?.enabled || !meta.owner || meta.owner === ownerOf(request) ||
        request.user?.permissions?.includes("*") || request.user?.permissions?.includes("files.admin");
    const view = (meta) => ({ id: meta.id, name: meta.name, mime: meta.mime, size: meta.size, url: driver.url(meta.id, { name: meta.name }) });
    const notFound = (reply) => reply.code(404).send({ ok: false, message: "file not found", code: "not_found" });

    fastify.post("/api/files", { onRequest: fastify.requireSignedIn }, async (request, reply) => {
        const part = await request.file();
        if (!part) return reply.code(400).send({ ok: false, message: 'send the file as multipart field "file"', code: "invalid_request" });
        let bytes;
        try {
            bytes = await part.toBuffer();
        } catch (err) {
            if (err.code === "FST_REQ_FILE_TOO_LARGE") {
                return reply.code(413).send({ ok: false, message: `files are limited to ${cfg.max_mb ?? 10} MB`, code: "payload_too_large" });
            }
            throw err;
        }
        const meta = await driver.put(bytes, { name: part.filename, owner: ownerOf(request) });
        if (!typeAllowed(meta.mime, cfg.types)) {
            await driver.remove(meta.id);
            return reply.code(415).send({ ok: false, message: `${meta.mime} files are not accepted`, code: "unsupported_media_type" });
        }
        await driver.claim(meta.id);
        return reply.code(201).send({ ok: true, data: view(meta) });
    });

    if (driver.name === "local") {
        // Before /api/files/:id so "raw" is never read as an id.
        fastify.get("/api/files/raw/:id", { schema: { params: { type: "object", properties: { id: { type: "string" } } } } }, serveRaw);
        fastify.get("/api/files/raw/:id/:name", serveRaw);
    }

    fastify.get("/api/files/:id", { onRequest: fastify.requireSignedIn, schema: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } } }, async (request, reply) => {
        const meta = await driver.get(request.params.id);
        if (!meta || !mayAccess(request, meta)) return notFound(reply); // someone else's file looks like no file
        return { ok: true, data: view(meta) };
    });

    fastify.post("/api/files/:id/delete", { onRequest: fastify.requireSignedIn, schema: { params: { type: "object", properties: { id: { type: "string", format: "uuid" } } } } }, async (request, reply) => {
        const meta = await driver.get(request.params.id);
        if (!meta || !mayAccess(request, meta)) return notFound(reply);
        await driver.remove(meta.id);
        return { ok: true, data: { id: meta.id, deleted: true } };
    });

    async function serveRaw(request, reply) {
        const meta = driver.checkTicket(request.params.id, request.query.t);
        if (!meta) return notFound(reply);
        const inline = INLINE.test(meta.mime);
        reply
            .type(meta.mime)
            .header("x-content-type-options", "nosniff")
            .header("content-security-policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox")
            .header("cache-control", "private, max-age=600")
            .header("content-disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(meta.name)}`);
        return reply.send(driver.stream(meta.id));
    }

    // Unclaimed uploads (the caller's save failed) are purged after a day — local driver; Bloteb
    // does its own.
    if (driver.name === "local" && fastify.cronManager && !fastify.cronManager.jobs.has("files-purge-pending")) {
        fastify.cronManager.createJob("files-purge-pending", "40 * * * *", async () => {
            const n = await fastify.files.purgePending(24);
            if (n) await log(`Files: purged ${n} unclaimed upload(s)`, import.meta.url);
        });
    }

    await log(`Files: driver "${driver.name}", max ${cfg.max_mb ?? 10} MB, types ${(cfg.types ?? []).join(", ") || "any"}`, import.meta.url);
});
