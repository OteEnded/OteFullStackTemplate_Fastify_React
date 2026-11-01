// Removes the DEMO feature (template items) in one step — used by the wizard.
// Do it BEFORE the first `db:migrate`, so the demo table never reaches a real schema
// (Ote's standard: delete the demo chain before the first boot).
//
// The demo is (1) whole files, listed below, and (2) marked lines in shared files:
//   ...code... // @demo                       one line
//   // @demo-start  ...  // @demo-end         a block (JSX: {/* @demo-start */} … {/* @demo-end */})
// Keep both up to date when the demo changes; test/unit + checks still pass after removal.

import fs from "node:fs";
import path from "node:path";

export const DEMO_FILES = [
    "Backend/app/routes/api/template-item.route.js",
    "Backend/database/models/mst_template_items.model.js",
    "Backend/database/migrations/002_demo_template_items.sql",
    "Backend/database/seeds/seed_template_items.js",
    "Frontend/src/pages/ExampleItemsPage.tsx",
    "test/unit/demo-items.test.mjs",
];

const SCAN_DIRS = ["Backend/app", "Backend/database", "Backend/lib", "Frontend/src", "test"];
const SCAN_EXT = new Set([".js", ".mjs", ".ts", ".tsx", ".css"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "shots"]);

function* walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
        } else if (SCAN_EXT.has(path.extname(entry.name))) {
            yield path.join(dir, entry.name);
        }
    }
}

export function stripDemoMarkers(text) {
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const out = [];
    let inBlock = false;
    for (const line of text.split(/\r?\n/)) {
        if (line.includes("@demo-start")) {
            inBlock = true;
            continue;
        }
        if (line.includes("@demo-end")) {
            inBlock = false;
            continue;
        }
        if (inBlock || /@demo\b(?!-)/.test(line)) continue;
        out.push(line);
    }
    if (inBlock) throw new Error("unclosed @demo-start block");
    return out.join(eol);
}

export function demoPresent(root) {
    return DEMO_FILES.some((rel) => fs.existsSync(path.join(root, rel)));
}

export function removeDemo(root) {
    const removed = [];
    const edited = [];
    for (const rel of DEMO_FILES) {
        const file = path.join(root, rel);
        if (fs.existsSync(file)) {
            fs.rmSync(file);
            removed.push(rel);
        }
    }
    for (const dir of SCAN_DIRS) {
        for (const file of walk(path.join(root, dir))) {
            const text = fs.readFileSync(file, "utf8");
            if (!text.includes("@demo")) continue;
            fs.writeFileSync(file, stripDemoMarkers(text));
            edited.push(path.relative(root, file).replace(/\\/g, "/"));
        }
    }
    return { removed, edited };
}
