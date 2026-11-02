import { createBlotebClient } from "../../../lib/bloteb-client.js";

// Driver "bloteb": files live in Bloteb (Ote's file service, C:\data\Otenization\Bloteb).
// Read C:\data\Otenization\Reference\docs\GUIDE_Bloteb_for_apps.md first — register the app
// there (slug, types, max size, quota) and put the bk1.… key in config.json (never in git).
//
// This app keeps the permission (who may see what) and stores only the blob id; Bloteb keeps
// the bytes, detects their real type, and serves them to short-lived tickets signed HERE.
// put() uploads as PENDING: save your row, then claim() — if your save fails, Bloteb deletes
// the pending blob by itself (the guide's "never leaves orphans" pattern, §5.2).

export function createBlotebDriver(config) {
    const c = config.files.bloteb;
    const client = createBlotebClient({ baseUrl: c.baseUrl, internalBaseUrl: c.internalBaseUrl || undefined, app: c.app, privateKey: c.key });
    const shape = (blob) => blob && {
        id: blob.id,
        name: blob.name,
        mime: blob.mime,
        size: blob.size,
        sha256: blob.sha256,
        owner: blob.ownerSub ?? null,
        state: blob.state,
        createdAt: blob.createdAt,
    };

    return {
        name: "bloteb",
        client,
        async put(bytes, { name = "file", owner = null } = {}) {
            try {
                return shape(await client.uploadFromServer(bytes, { name, owner: owner ?? undefined, state: "pending" }));
            } catch (err) {
                // Bloteb's refusals are the CALLER's problem (wrong type / too big), not a server error:
                // pass them on as 415 / 413 with Bloteb's message instead of a 500.
                if (err.status === 415 || err.status === 413) {
                    throw Object.assign(new Error(err.body?.message || err.message), {
                        statusCode: err.status,
                        code: err.status === 415 ? "unsupported_media_type" : "payload_too_large",
                    });
                }
                throw err;
            }
        },
        async claim(id) {
            return shape(await client.claim(id));
        },
        async get(id) {
            try {
                const blob = shape(await client.get(id));
                return blob?.state === "deleted" ? null : blob;
            } catch (err) {
                if (err.status === 404) return null;
                throw err;
            }
        },
        url(id, { name, ttlSeconds = 3600 } = {}) {
            return client.readUrl(id, { name, ttl: ttlSeconds });
        },
        async bytes(id) {
            return client.fetchBytes(id);
        },
        async remove(id) {
            try {
                await client.remove(id);
                return true;
            } catch (err) {
                if (err.status === 404) return false;
                throw err;
            }
        },
        async purgePending() {
            return 0; // Bloteb purges its own pending blobs (limits.pendingTtlHours)
        },
    };
}
