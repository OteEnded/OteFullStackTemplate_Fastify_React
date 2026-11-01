// The boot guard must pass the shipped example and list EVERY problem in a bad config.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { testConfig, loadBackend, BACKEND } from "../lib/backend.mjs";

let checkConfig;
before(async () => {
    ({ checkConfig } = await loadBackend(testConfig()));
});

test("config.example.json as shipped passes", () => {
    const example = JSON.parse(fs.readFileSync(path.join(BACKEND, "config.example.json"), "utf-8"));
    assert.deepEqual(checkConfig(example), []);
});

test("a bad config reports every problem at once", () => {
    const bad = testConfig({
        app: { port: "x", host: "", public_origins: ["*", "https://a.example/path"], trust_proxy: true },
        database: { enabled: true, connection: { password: "CHANGE_ME", username: "", database: "" } },
    });
    const problems = checkConfig(bad);
    const expected = [/app\.port/, /app\.host/, /"\*"/, /not an origin/, /trust_proxy: true/, /CHANGE_ME/, /username is empty/, /database is empty/];
    for (const pattern of expected) {
        assert.ok(problems.some((p) => pattern.test(p)), `missing problem matching ${pattern}:\n${problems.join("\n")}`);
    }
});
