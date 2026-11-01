// UI drive: every page in LIGHT and DARK, at desktop and phone width, against a PRIVATE test
// instance (port 8081, DB off) serving the BUILT frontend (Backend/public/dist).
// Screenshots → test/shots/active/ — LOOK at them; a green run is not a design review.
//
//   cd Frontend && npm run build          (first)
//   cd test && node ui/console-ui.mjs     (HEADED=1 to watch)
//
// The demo's populated list is driven against a MOCKED /api/template-items (in-memory, same
// envelope + GET/POST contract) so the table, dialog, confirm and toasts are exercised without
// a database. The real DB-off answer (503 db_disabled → friendly callout) is checked too.

import fs from "node:fs";
import path from "node:path";
import { makeChecker } from "../lib/checker.mjs";
import { testConfig, startServer, stopServer, BACKEND } from "../lib/backend.mjs";
import { launch, newPage, settle, snap, overflowX, clearShots, VIEWPORTS, SHOTS } from "../lib/ui.mjs";

const { check, done } = makeChecker("console-ui — pages × themes × widths, theme boot, demo flows");

const DIST = path.join(BACKEND, "public", "dist", "index.html");
if (!fs.existsSync(DIST)) {
    console.log("  FAIL frontend is not built — run `npm run build` in Frontend first");
    console.log("\n1 CHECK(S) FAILED:\n  - Backend/public/dist/index.html missing");
    process.exit(1);
}

// The demo may have been removed by the wizard — its flows run only while it exists.
const HAS_DEMO = fs.existsSync(path.join(BACKEND, "app", "routes", "api", "template-item.route.js"));
const PREPAINT = { dark: "rgb(23, 19, 16)", light: "rgb(243, 239, 231)" }; // index.html pre-paint (#171310 / #f3efe7)

const PAGES = [
    { name: "landing", path: "/", ready: "h1" },
    { name: "login", path: "/login", ready: "form" },
    { name: "dashboard", path: "/console", ready: "h1:has-text('Dashboard')" },
    ...(HAS_DEMO ? [{ name: "items-dboff", path: "/console/items", ready: "h1:has-text('Template items')" }] : []),
    { name: "settings", path: "/console/settings", ready: "h1:has-text('Settings')" },
    { name: "uikit", path: "/console/ui", ready: "h1, [data-page=not-found]", devOnly: true },
    { name: "notfound", path: "/no-such-page", ready: "[data-page=not-found]" },
    { name: "notfound-console", path: "/console/no-such-page", ready: "[data-page=not-found]" },
];

// Console errors that are EXPECTED: the browser logs the demo's 503 (DB off) as a resource error.
const expectedError = (e) => /status of 503/.test(e) && /\/api\/template-items/.test(e);

// ---- in-memory mock of the demo API (same contract: envelope, GET + POST only) ----
function mockItems(page) {
    const now = Date.now();
    let seq = 1000;
    const mk = (name, status, priority, summary = "", ageMin = 0) => ({
        uuid: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
        rolling_id: seq, name, summary, status, priority,
        created_at: new Date(now - ageMin * 60000).toISOString(), updated_at: new Date(now - ageMin * 60000).toISOString(),
    });
    const items = [
        mk("Quarterly report export", "active", "high", "CSV + PDF for the finance team", 12),
        mk("รายงานประจำเดือน ตุลาคม", "draft", "medium", "สรุปยอดขายและค่าใช้จ่าย", 95),
        mk("Sync partner catalogue", "active", "low", "", 60 * 26),
        mk("Archive old sessions", "archived", "low", "Older than 90 days", 60 * 24 * 5),
    ];
    const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    return page.route("**/api/template-items**", async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const id = url.pathname.split("/")[3];
        if (req.method() === "GET" && !id) {
            const status = url.searchParams.get("status");
            const rows = items.filter((i) => !status || i.status === status).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
            return json(route, 200, { ok: true, data: rows });
        }
        if (req.method() !== "POST") return json(route, 404, { ok: false, message: "Route not found", code: "not_found" });
        const body = req.postDataJSON() ?? {};
        if (!id) {
            const row = mk(body.name, body.status ?? "draft", body.priority ?? "medium", body.summary ?? "");
            items.push(row);
            return json(route, 201, { ok: true, data: row });
        }
        const row = items.find((i) => i.uuid === id);
        if (!row) return json(route, 404, { ok: false, message: "item not found", code: "not_found" });
        Object.assign(row, body, { updated_at: new Date().toISOString() });
        return json(route, 200, { ok: true, data: row });
    });
}

let server;
let browser;
let config;
try {
    clearShots();
    config = testConfig();
    server = await startServer(config);
    const base = server.base;
    browser = await launch();

    // ---------- 1. theme boot: right theme BEFORE the app/stylesheet arrive ----------
    for (const [label, opts, want] of [
        ["first visit, device dark", { colorScheme: "dark" }, "dark"],
        ["first visit, device light", { colorScheme: "light" }, "light"],
        ["stored 'light' beats a dark device", { colorScheme: "dark", storedTheme: "light" }, "light"],
        ["stored 'dark' beats a light device", { colorScheme: "light", storedTheme: "dark" }, "dark"],
    ]) {
        const page = await newPage(browser, opts);
        let release;
        const held = new Promise((r) => (release = r));
        await page.route("**/assets/**", async (route) => {
            await held;
            await route.continue().catch(() => {});
        });
        await page.goto(`${base}/console`, { waitUntil: "commit" });
        await page.waitForFunction(() => document.getElementById("root") !== null);
        const pre = await page.evaluate(() => ({
            theme: document.documentElement.dataset.theme,
            bg: getComputedStyle(document.documentElement).backgroundColor,
            mounted: (document.getElementById("root")?.childElementCount ?? 0) > 0,
        }));
        release();
        check(`pre-paint (${label}): data-theme=${want} before the app mounts`, !pre.mounted && pre.theme === want, JSON.stringify(pre));
        check(`pre-paint (${label}): background is the ${want} --bg already`, pre.bg === PREPAINT[want], pre.bg);
        await page.waitForSelector("h1");
        await settle(page, 50);
        const after = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
        check(`pre-paint (${label}): index.html colour matches tokens.css --bg (no jump)`, after === pre.bg, `${pre.bg} → ${after}`);
        await page.context().close();
    }

    // ---------- 2. every page × theme × width ----------
    let kitPresent = false;
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
        for (const theme of ["light", "dark"]) {
            const page = await newPage(browser, { viewport, colorScheme: theme });
            for (const p of PAGES) {
                await page.goto(`${base}${p.path}`);
                await page.waitForSelector(p.ready, { timeout: 10000 });
                await settle(page);
                if (p.devOnly) {
                    const missing = await page.locator("[data-page=not-found]").count();
                    if (missing) {
                        if (vpName === "desktop" && theme === "light") console.log(`  skip ${p.path} — dev-only page, absent from this production build (expected)`);
                        continue;
                    }
                    kitPresent = true;
                }
                const tag = `${p.name}-${theme}-${vpName}`;
                const domTheme = await page.evaluate(() => document.documentElement.dataset.theme);
                check(`${tag}: renders in ${theme}`, domTheme === theme, domTheme);
                if (vpName === "phone") {
                    const ox = await overflowX(page);
                    check(`${tag}: no sideways page scroll at 375px`, ox <= 0, `${ox}px`);
                }
                await snap(page, tag);
            }
            const errors = page.errors.filter((e) => !expectedError(e));
            check(`${vpName}/${theme}: no console errors across all pages`, errors.length === 0, errors.slice(0, 3).join(" | "));
            const external = page.requests.filter((u) => !u.startsWith(base) && !u.startsWith("data:"));
            check(`${vpName}/${theme}: no third-party requests (fonts self-hosted)`, external.length === 0, external.slice(0, 3).join(", "));
            await page.context().close();
        }
    }
    if (!kitPresent) console.log("  note /console/ui not shot (production build) — build with NODE_ENV=development to include it");

    // ---------- 3. behaviour ----------
    {
        const page = await newPage(browser, { colorScheme: "light" });
        await page.goto(`${base}/console`);
        await page.waitForSelector("h1:has-text('Dashboard')");
        await settle(page);
        check("dashboard: health shows the service name", (await page.locator(".stat").first().innerText()).includes(config.app.name));
        check("dashboard: DB stat says Off (DB disabled)", (await page.locator(".stat", { hasText: "Database" }).innerText()).includes("Off"));
        // The landing page has Thai text, so both faces must have loaded — from this origin.
        await page.goto(`${base}/`);
        await page.waitForSelector("h1");
        await settle(page);
        const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")));
        check("fonts: Space Grotesk + Noto Sans Thai loaded (self-hosted)", loaded.includes("Space Grotesk") && loaded.includes("Noto Sans Thai"), loaded.join(", "));
        await page.goto(`${base}/console`);
        await page.waitForSelector("h1:has-text('Dashboard')");
        await settle(page);

        // theme toggle cycles and persists under the shared key
        const before = await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("ote:theme")]);
        await page.click("[data-ui=theme-toggle]");
        const after = await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("ote:theme")]);
        check("theme toggle: system → dark, saved as ote:theme", before[0] === "light" && after[0] === "dark" && after[1] === "dark", `${before} → ${after}`);
        await page.click("[data-ui=theme-toggle]");
        check("theme toggle: dark → light", (await page.evaluate(() => document.documentElement.dataset.theme)) === "light");

        // settings: theme radio + About tab
        await page.goto(`${base}/console/settings`);
        await page.waitForSelector("h1:has-text('Settings')");
        await page.check("input[name=theme][value=dark]");
        check("settings: picking Dark applies it", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
        await page.check("input[name=theme][value=system]");
        await page.click("[role=tab]:has-text('About')");
        await page.waitForSelector("dl");
        const about = await page.locator("dl").innerText();
        check("settings → About: version + database from /api/health", /Version/.test(about) && /Off/.test(about), about.replace(/\s+/g, " ").slice(0, 120));
        check("settings → About: tab is in the URL", page.url().includes("tab=about"));

        // login stub
        await page.goto(`${base}/login`);
        await page.click("button[type=submit]");
        check("login: empty submit shows field errors", (await page.locator(".field-error").count()) === 2);
        await page.fill("input[autocomplete=username]", "root");
        await page.fill("input[autocomplete=current-password]", "secret");
        await page.click("button[type=submit]");
        await page.waitForSelector(".callout");
        check("login: stub explains sign-in isn't enabled yet (Slice 8)", /isn't enabled yet/.test(await page.locator(".callout").innerText()));
        await page.click("button.pw-peek");
        check("login: password peek shows the text", (await page.getAttribute("input[autocomplete=current-password]", "type")) === "text");

        if (HAS_DEMO) {
            await page.goto(`${base}/console/items`);
            await page.waitForSelector(".callout");
            check("items (real backend, DB off): friendly 'needs a database' callout, not an error", /needs a database/.test(await page.locator(".callout").innerText()));
        }
        const errors = page.errors.filter((e) => !expectedError(e));
        check("behaviour: no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
        await page.context().close();
    }

    // ---------- 4. phone drawer ----------
    {
        const page = await newPage(browser, { viewport: VIEWPORTS.phone, colorScheme: "dark" });
        await page.goto(`${base}/console/settings`);
        await page.waitForSelector("h1:has-text('Settings')");
        check("phone: side nav is hidden until opened", !(await page.locator("#console-nav").isVisible()));
        await page.click("button[aria-controls=console-nav]");
        await page.waitForTimeout(300);
        check("phone: menu button opens the drawer", await page.locator("#console-nav").isVisible());
        await snap(page, "drawer-dark-phone");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        check("phone: Esc closes the drawer", !(await page.locator("#console-nav").isVisible()));
        await page.click("button[aria-controls=console-nav]");
        await page.click("#console-nav a:has-text('Dashboard')");
        await page.waitForSelector("h1:has-text('Dashboard')");
        await page.waitForTimeout(300);
        check("phone: choosing a page closes the drawer", !(await page.locator("#console-nav").isVisible()));
        await page.context().close();
    }

    // ---------- 5. demo flows on a mocked items API ----------
    if (HAS_DEMO) {
        for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
            for (const theme of ["light", "dark"]) {
                const page = await newPage(browser, { viewport, colorScheme: theme });
                await mockItems(page);
                await page.goto(`${base}/console/items`);
                await page.waitForSelector("table tbody tr td:has-text('Quarterly')");
                await settle(page);
                if (vpName === "phone") check(`items-${theme}-phone: table scrolls inside its wrapper, not the page`, (await overflowX(page)) <= 0);
                await snap(page, `items-${theme}-${vpName}`);
                await page.goto(`${base}/console`);
                await page.waitForSelector("table tbody tr td:has-text('Quarterly')");
                await settle(page);
                await snap(page, `dashboard-data-${theme}-${vpName}`);
                await page.context().close();
            }
        }

        const page = await newPage(browser, { colorScheme: "light" });
        await mockItems(page);
        await page.goto(`${base}/console/items`);
        await page.waitForSelector("table tbody tr td:has-text('Quarterly')");
        await settle(page);

        // create through the dialog
        await page.click("button:has-text('New item')");
        const dialog = page.locator("dialog[open]");
        await dialog.waitFor();
        check("new item: dialog opens with focus in the first field", await page.evaluate(() => document.activeElement?.tagName === "INPUT"));
        await page.click("dialog[open] button[type=submit]");
        check("new item: empty name → field error, dialog stays", (await page.locator("dialog[open] .field-error").count()) === 1);
        // drag-safe: press inside the dialog, release on the backdrop → must stay open
        const box = await page.locator("dialog[open] input").first().boundingBox();
        await page.mouse.move(box.x + 10, box.y + 10);
        await page.mouse.down();
        await page.mouse.move(8, 8, { steps: 4 });
        await page.mouse.up();
        check("dialog: a drag that ends on the backdrop does NOT close it", (await page.locator("dialog[open]").count()) === 1);
        await page.fill("dialog[open] input", "Weekly digest / สรุปรายสัปดาห์");
        await snap(page, "items-dialog-light-desktop");
        await page.keyboard.press("Enter");
        await page.waitForSelector(".toast:has-text('Item created')");
        check("new item: Enter submits, toast confirms", true);
        check("new item: dialog closed after save", (await page.locator("dialog[open]").count()) === 0);
        await page.waitForSelector("td:has-text('Weekly digest')");
        check("new item: list reloads with the new row", true);

        // Esc closes a dialog and focus returns to the opener
        await page.click("button[aria-label^='Edit Quarterly']");
        await page.locator("dialog[open]").waitFor();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(100);
        check("dialog: Esc closes it", (await page.locator("dialog[open]").count()) === 0);
        check("dialog: focus returns to the button that opened it", await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") ?? "").startsWith("Edit Quarterly")));

        // archive through the row menu + confirm
        await page.click("button[aria-label^='More actions for Quarterly']");
        await page.waitForSelector("[role=menu]:popover-open");
        const menuFocused = await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem", null, { timeout: 2000 }).then(() => true, () => false);
        check("row menu: opens with focus on the first item", menuFocused);
        await page.keyboard.press("ArrowDown");
        check("row menu: arrow keys move between items", await page.evaluate(() => document.activeElement?.textContent?.includes("Archive")));
        await snap(page, "items-menu-light-desktop");
        await page.click("[role=menu]:popover-open [role=menuitem]:has-text('Archive')");
        await page.locator("dialog[open]").waitFor();
        await snap(page, "items-confirm-light-desktop");
        check("archive: asks first (themed confirm, not window.confirm)", /Archive “Quarterly report export”\?/.test(await page.locator("dialog[open]").innerText()));
        await page.click("dialog[open] [data-ui=confirm-yes]");
        await page.waitForSelector(".toast:has-text('Item archived')");
        const row = page.locator("tr", { hasText: "Quarterly report export" });
        await row.locator("text=Archived").waitFor();
        check("archive: row now shows Archived", true);

        // search + status filter
        await page.fill("input[type=search]", "ตุลาคม");
        check("search: filters rows (Thai text)", (await page.locator("tbody tr").count()) === 1);
        await page.fill("input[type=search]", "");
        await page.selectOption("select[aria-label='Filter by status']", "archived");
        await page.waitForFunction(() => [...document.querySelectorAll("tbody tr")].every((tr) => tr.textContent.includes("Archived")));
        check("status filter: asks the API with ?status=archived", page.requests.some((u) => u.includes("status=archived")));

        const errors = page.errors.filter((e) => !expectedError(e));
        check("demo flows: no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
        await page.context().close();
    }

    console.log(`\n  screenshots: ${SHOTS}`);
} catch (err) {
    check("drive completed without an exception", false, err?.stack?.split("\n").slice(0, 4).join(" ") ?? String(err));
} finally {
    await browser?.close();
    await stopServer(server);
    done();
}
