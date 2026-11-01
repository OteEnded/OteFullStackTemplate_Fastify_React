// The optional realtime module, live: SSE + WebSocket fed by one hub. Runs the app
// in-process on the test port with a test-only publish route; DB off.
import path from "node:path";
import { createRequire } from "node:module";
import { makeChecker } from "../lib/checker.mjs";
import { testConfig, loadBackend, portIsFree, TEST_PORT, BACKEND } from "../lib/backend.mjs";

const { check, done } = makeChecker("realtime.check — SSE and WebSocket push from one hub");
const ORIGIN = "https://app.example.com";
const config = testConfig({
    app: { public_origins: [ORIGIN] },
    realtime: { sse: { enabled: true }, websocket: { enabled: true } },
});
// `ws` is the client/server library under @fastify/websocket — no extra test dependency.
const WebSocket = createRequire(createRequire(path.join(BACKEND, "package.json")).resolve("@fastify/websocket"))("ws");

const { buildApp } = await loadBackend(config);
const base = `http://127.0.0.1:${TEST_PORT}`;
let app;
let auth;

const waitFor = (predicate, ms = 3000) => new Promise((resolve) => {
    const started = Date.now();
    const tick = () => (predicate() ? resolve(true) : Date.now() - started > ms ? resolve(false) : setTimeout(tick, 25));
    tick();
});

try {
    if (!(await portIsFree(TEST_PORT))) throw new Error(`test port ${TEST_PORT} is already in use`);
    app = await buildApp(config);
    app.post("/api/test-publish", async (request) => {
        app.realtime.publish(request.body.channel, request.body.type, request.body.data);
        return { ok: true, data: null };
    });
    await app.listen({ port: TEST_PORT, host: "127.0.0.1" });
    const publish = (channel, type, data) => fetch(`${base}/api/test-publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel, type, data }) });

    // --- SSE ---
    const controller = new AbortController();
    const sse = await fetch(`${base}/api/events?channels=items`, { headers: { origin: ORIGIN }, signal: controller.signal });
    check("SSE answers 200 text/event-stream", sse.status === 200 && /text\/event-stream/.test(sse.headers.get("content-type")));
    check("SSE keeps the CORS header for an allowed origin (raw writeHead used to drop it)", sse.headers.get("access-control-allow-origin") === ORIGIN);
    let sseText = "";
    const reader = sse.body.getReader();
    (async () => {
        try {
            for (;;) {
                const { value, done: finished } = await reader.read();
                if (finished) break;
                sseText += new TextDecoder().decode(value);
            }
        } catch {
            // aborted at the end
        }
    })();
    await waitFor(() => sseText.includes("sys.ready"));

    // --- WebSocket ---
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/api/ws?channels=items`);
    const wsMessages = [];
    ws.on("message", (raw) => wsMessages.push(JSON.parse(String(raw))));
    await new Promise((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
    await waitFor(() => wsMessages.some((m) => m.type === "sys.welcome"));
    check("WebSocket opens and greets with sys.welcome", wsMessages[0]?.type === "sys.welcome");

    ws.send(JSON.stringify({ type: "sys.ping", id: 7 }));
    check("sys.ping -> sys.pong (same id)", await waitFor(() => wsMessages.some((m) => m.type === "sys.pong" && m.data.id === 7)));
    ws.send(JSON.stringify({ type: "item.delete", data: {} }));
    check("actions over the socket are refused (push-only)", await waitFor(() => wsMessages.some((m) => m.type === "sys.error" && m.data.error === "unsupported_type")));

    await publish("items", "item.created", { uuid: "u-1" });
    await publish("other", "other.thing", { x: 1 });
    check("one publish reaches the SSE stream", await waitFor(() => sseText.includes("event: item.created") && sseText.includes("u-1")));
    check("... and the WebSocket", await waitFor(() => wsMessages.some((m) => m.type === "item.created" && m.data.uuid === "u-1")));
    await new Promise((r) => setTimeout(r, 300));
    check("channel filter: the 'other' channel reached neither", !sseText.includes("other.thing") && !wsMessages.some((m) => m.type === "other.thing"));

    ws.close();
    controller.abort();
    await waitFor(() => app.realtime.stats().websocket === 0 && app.realtime.stats().sse === 0);
    check("closed connections are released", app.realtime.stats().websocket === 0 && app.realtime.stats().sse === 0, JSON.stringify(app.realtime.stats()));
    await app.close();
    app = null;

    // --- with the auth module on, both endpoints need a session ---
    const bcrypt = createRequire(path.join(BACKEND, "package.json"))("bcryptjs");
    const authConfig = { ...config, auth: { ...config.auth, enabled: true, session: { secret: "z".repeat(40) }, root: { enabled: true, username: "root", password_hash: bcrypt.hashSync("pw-123456", 4) } } };
    auth = await buildApp(authConfig);
    await auth.listen({ port: TEST_PORT, host: "127.0.0.1" });
    check("auth on: SSE without a session -> 401", (await fetch(`${base}/api/events`)).status === 401);
    const refused = await new Promise((resolve) => {
        const s = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/api/ws`);
        s.on("unexpected-response", (_req, res) => resolve(res.statusCode));
        s.on("open", () => { s.close(); resolve("opened"); });
        s.on("error", () => resolve("error"));
    });
    check("auth on: WebSocket upgrade without a session -> 401", refused === 401, String(refused));
} catch (err) {
    check("realtime checks could run", false, err.stack || err.message);
} finally {
    await app?.close().catch(() => {});
    await auth?.close().catch(() => {});
}

done();
setTimeout(() => process.exit(process.exitCode ?? 0), 200).unref();
