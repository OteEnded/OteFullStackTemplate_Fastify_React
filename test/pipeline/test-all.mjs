// One command, real exit code.     npm run test-all   [-- --checks-only]
//
// Runs unit/ (node:test), then every checks/*.check.mjs. Each suite is judged by
// its PASS LINE — "ℹ fail 0" for node:test, "ALL CHECKS PASSED (n)" for a check —
// never by its last line or exit code alone (a check whose last line was a log
// line once hid a failure in the Portal). "SKIPPED: …" is neutral, not green.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const rows = [];

// Precondition: the backend must be installed, or every suite fails for a reason
// that has nothing to do with the code under test.
if (!fs.existsSync(path.join(ROOT, "..", "Backend", "node_modules"))) {
    console.error("Backend/node_modules is missing — run `npm install` in Backend first.");
    process.exit(1);
}

function run(label, cmdArgs, passTest) {
    const started = Date.now();
    const r = spawnSync(process.execPath, cmdArgs, { cwd: ROOT, encoding: "utf8" });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const skipped = /^SKIPPED: (.*)$/m.exec(out);
    const state = skipped ? "SKIP " : r.status === 0 && passTest(out) ? "GREEN" : "RED  ";
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    rows.push({ label, state });
    console.log(`${state}  ${label}  (${secs}s)${skipped ? ` — ${skipped[1]}` : ""}`);
    if (state === "RED  ") {
        const lines = out.split("\n").filter((l) => /FAIL|✖|not ok|Error|error:/.test(l)).slice(0, 15);
        console.log((lines.length ? lines : out.split("\n").slice(-15)).map((l) => `        ${l}`).join("\n"));
    }
}

if (!args.has("--checks-only")) {
    run("unit", ["--test", "--test-concurrency=1", "unit/*.test.mjs"], (out) => /ℹ fail 0/.test(out) && /ℹ pass [1-9]/.test(out));
}

const checksDir = path.join(ROOT, "checks");
for (const file of fs.readdirSync(checksDir).filter((f) => f.endsWith(".check.mjs")).sort()) {
    run(`checks/${file}`, [path.join("checks", file)], (out) => /ALL CHECKS PASSED \(\d+\)/.test(out));
}

const red = rows.filter((r) => r.state === "RED  ");
const skipped = rows.filter((r) => r.state === "SKIP ");
console.log(
    red.length === 0
        ? `\nALL GREEN (${rows.length - skipped.length} suites${skipped.length ? `, ${skipped.length} skipped` : ""})`
        : `\n${red.length} of ${rows.length} SUITES RED: ${red.map((r) => r.label).join(", ")}`,
);
process.exit(red.length === 0 ? 0 : 1);
