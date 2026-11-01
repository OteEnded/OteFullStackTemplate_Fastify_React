import fp from "fastify-plugin";
import { EventEmitter } from "events";
import { log } from "../../../lib/utility.js";

// OPTIONAL REALTIME MODULE — server → browser push. Off unless enabled in config:
//   realtime.sse.enabled        GET /api/events?channels=a,b     (Server-Sent Events)
//   realtime.websocket.enabled  GET /api/ws                      (WebSocket, push-only)
// Ote: "can we support both sse and ws? some app still req ws tho." — both feed from
// ONE in-process hub, so app code publishes once and both transports deliver:
//
//   fastify.realtime.publish("items", "item.created", { uuid })
//
// Push only: browsers send ACTIONS through the normal GET/POST API, never over the socket
// (DragonConnect's rule — one place for validation, auth and logging). With the auth
// module on, both endpoints need a signed-in session. Removable: delete this folder,
// its register line in app.js and the "realtime" config block.

const HEARTBEAT_MS = 25_000;

function envelope(type, data, channel) {
    return JSON.stringify({ type, channel, data, ts: new Date().toISOString() });
}

export default fp(async function realtime(fastify) {
    const cfg = fastify.config.realtime ?? {};
    const hub = new EventEmitter();
    hub.setMaxListeners(0);
    const stats = { sse: 0, websocket: 0 };

    fastify.decorate("realtime", {
        publish(channel, type, data = {}) {
            hub.emit("message", { channel, type, data });
        },
        stats: () => ({ ...stats }),
    });

    const wanted = (raw) => new Set(String(raw ?? "").split(",").map((c) => c.trim()).filter(Boolean));
    const matches = (channels, channel) => channels.size === 0 || channels.has(channel);

    // ---- SSE -------------------------------------------------------------------------
    if (cfg.sse?.enabled) {
        fastify.get("/api/events", { onRequest: fastify.requireSignedIn }, async (request, reply) => {
            const channels = wanted(request.query.channels);
            // ⚠ Copy the headers Fastify already set on the reply (CORS, etc.) into the raw
            // response: writing reply.raw directly skips them, which silently broke
            // cross-origin SSE in OLS/OteRM.
            reply.hijack();
            reply.raw.writeHead(200, {
                ...reply.getHeaders(),
                "content-type": "text/event-stream; charset=utf-8",
                "cache-control": "no-cache, no-transform",
                connection: "keep-alive",
                "x-accel-buffering": "no", // nginx: don't buffer the stream
            });
            const send = (event, payload) => reply.raw.write(`event: ${event}\ndata: ${payload}\n\n`);
            send("ready", envelope("sys.ready", { channels: [...channels] }));

            const onMessage = (m) => {
                if (matches(channels, m.channel)) send(m.type, envelope(m.type, m.data, m.channel));
            };
            const heartbeat = setInterval(() => reply.raw.write(": keep-alive\n\n"), HEARTBEAT_MS);
            hub.on("message", onMessage);
            stats.sse++;
            request.raw.on("close", () => {
                clearInterval(heartbeat);
                hub.off("message", onMessage);
                stats.sse--;
            });
        });
        await log("Realtime: SSE on GET /api/events", import.meta.url);
    }

    // ---- WebSocket -------------------------------------------------------------------
    if (cfg.websocket?.enabled) {
        const { default: websocket } = await import("@fastify/websocket");
        await fastify.register(websocket);

        fastify.get("/api/ws", { websocket: true, onRequest: fastify.requireSignedIn }, (socket, request) => {
            const channels = wanted(request.query.channels);
            socket.send(envelope("sys.welcome", { user: request.user ? { name: request.user.name, kind: request.user.kind } : null, channels: [...channels] }));

            const onMessage = (m) => {
                if (matches(channels, m.channel) && socket.readyState === 1) socket.send(envelope(m.type, m.data, m.channel));
            };
            hub.on("message", onMessage);
            stats.websocket++;

            socket.on("message", (raw) => {
                let msg = null;
                try {
                    msg = JSON.parse(String(raw));
                } catch {
                    msg = null;
                }
                if (msg?.type === "sys.ping") return socket.send(envelope("sys.pong", { id: msg.id ?? null }));
                socket.send(envelope("sys.error", { error: "unsupported_type", hint: "This socket only pushes; send actions through the API (GET/POST)" }));
            });
            socket.on("close", () => {
                hub.off("message", onMessage);
                stats.websocket--;
            });
        });

        // Close open sockets on shutdown so fastify.close() doesn't wait on them.
        fastify.addHook("onClose", async () => {
            for (const client of fastify.websocketServer?.clients ?? []) client.close(1001, "server shutting down");
        });
        await log("Realtime: WebSocket on GET /api/ws", import.meta.url);
    }
});
