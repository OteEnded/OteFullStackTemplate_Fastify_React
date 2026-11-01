// Helpers for ui/*-ui.mjs drives (Playwright, against a PRIVATE test instance).
//
//   launch()               Edge (installed on Windows — no browser download). HEADLESS by default;
//                          HEADED=1 (or HEADLESS=0) to watch it run.
//   newPage(browser, o)    { viewport, colorScheme, storedTheme } → page with page.errors (console
//                          errors + page errors) and page.requests (every URL asked for)
//   settle(page)           network idle + fonts loaded + a beat for transitions
//   snap(page, name)       full-page screenshot → test/shots/active/<name>.png (gitignored)
//   overflowX(page)        px the page scrolls sideways (0 = none)
//   VIEWPORTS              desktop 1440×900, phone 375×812

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHOTS = path.join(HERE, "..", "shots", "active");

export const VIEWPORTS = {
    desktop: { width: 1440, height: 900 },
    phone: { width: 375, height: 812 },
};

export async function loadPlaywright() {
    try {
        return await import("playwright");
    } catch {
        throw new Error("playwright is not installed — run `npm install` in test/");
    }
}

export async function launch() {
    const { chromium } = await loadPlaywright();
    const headed = process.env.HEADED === "1" || process.env.HEADLESS === "0";
    const options = { headless: !headed, slowMo: headed ? 40 : 0 };
    try {
        return await chromium.launch({ ...options, channel: "msedge" });
    } catch {
        // Not Windows / no Edge: fall back to Playwright's own Chromium (npx playwright install chromium).
        return chromium.launch(options);
    }
}

export async function newPage(browser, { viewport = VIEWPORTS.desktop, colorScheme = "dark", storedTheme } = {}) {
    const context = await browser.newContext({ viewport, colorScheme, reducedMotion: "reduce" });
    if (storedTheme) {
        await context.addInitScript((t) => {
            try { localStorage.setItem("ote:theme", t); } catch { /* storage blocked */ }
        }, storedTheme);
    }
    const page = await context.newPage();
    page.errors = [];
    page.requests = [];
    page.on("console", (m) => {
        if (m.type() !== "error") return;
        page.errors.push(`${m.text()}${m.location()?.url ? ` @ ${m.location().url}` : ""}`);
    });
    page.on("pageerror", (e) => page.errors.push(`pageerror: ${e.message}`));
    page.on("request", (r) => page.requests.push(r.url()));
    return page;
}

export async function settle(page, ms = 250) {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForTimeout(ms);
}

export async function snap(page, name) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const file = path.join(SHOTS, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
}

export async function overflowX(page) {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Remove last run's screenshots so the folder only ever holds the current run. */
export function clearShots() {
    fs.rmSync(SHOTS, { recursive: true, force: true });
    fs.mkdirSync(SHOTS, { recursive: true });
}
