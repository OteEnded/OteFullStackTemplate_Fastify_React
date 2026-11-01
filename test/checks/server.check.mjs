// Live process checks against a PRIVATE instance on the reserved test port
// (app.port + 1). Never touches a running dev/prod instance.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeChecker } from "../lib/checker.mjs";
import { testConfig, writeConfig, startServer, stopServer, runServer } from "../lib/backend.mjs";

const { check, done } = makeChecker("server.check — process behaviour of server.js");
const config = testConfig({ logging: { request: { log_to_file: true } } });
let server;

function waitExit(child, timeoutMs = 15000) {
    return new Promise((resolve) => {
        let out = "";
        child.stdout?.on("data", (d) => (out += d));
        child.stderr?.on("data", (d) => (out += d));
        const timer = setTimeout(() => {
            child.kill();
            resolve({ code: "timeout", out });
        }, timeoutMs);
        child.on("exit", (code) => {
            clearTimeout(timer);
            resolve({ code, out });
        });
    });
}

try {
    server = await startServer(config);
    const health = await (await fetch(`${server.base}/api/health`)).json();
    check("starts on the test port and answers /api/health in the envelope", health.ok === true && health.data?.service === config.app.name, JSON.stringify(health));

    // Loopback by default: the instance must NOT answer on this machine's LAN address.
    const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal);
    if (lan) {
        let reachable = true;
        try {
            await fetch(`http://${lan.address}:${server.port}/api/health`, { signal: AbortSignal.timeout(1500) });
        } catch {
            reachable = false;
        }
        check(`not reachable on the LAN address ${lan.address} (app.host defaults to 127.0.0.1)`, !reachable);
    }

    // Secrets sent to the server never reach the request log file.
    await fetch(`${server.base}/api/template-items?code=OAUTH_SECRET_1`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "sid=COOKIE_SECRET_2", authorization: "Bearer AUTH_SECRET_3" },
        body: JSON.stringify({ name: "probe", password: "BODY_SECRET_4" }),
    });
    await new Promise((r) => setTimeout(r, 500));
    const logDir = config.logging.request.log_directory;
    const requestLogs = fs.readdirSync(logDir).filter((f) => f.startsWith("requests_")).map((f) => fs.readFileSync(path.join(logDir, f), "utf-8")).join("");
    check("request log file was written", requestLogs.includes("POST /api/template-items"), requestLogs.slice(0, 200));
    check("no cookie / authorization / query / body secret in the request log", !/SECRET_[1-4]/.test(requestLogs));

    // A second instance on the same port must say so loudly and exit non-zero.
    const second = await waitExit(runServer(writeConfig(config)));
    check("second instance on the same port -> exit code 2 + 'already in use' banner", second.code === 2 && /already in use/.test(second.out), `code ${second.code}`);
} catch (err) {
    check("test server could be started", false, err.message);
} finally {
    await stopServer(server);
}

// A config with problems must refuse to start and list every one.
const bad = testConfig({ app: { host: "", public_origins: ["*"] }, database: { enabled: true, connection: { password: "CHANGE_ME", username: "" } } });
const refused = await waitExit(runServer(writeConfig(bad)));
check("bad config -> exit code 1, nothing started", refused.code === 1, `code ${refused.code}`);
check("bad config -> every problem listed", /problem\(s\)/.test(refused.out) && /CHANGE_ME/.test(refused.out) && /app\.host/.test(refused.out) && /"\*"/.test(refused.out));

done();
