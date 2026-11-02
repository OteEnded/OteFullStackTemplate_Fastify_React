// UI drive: sign-in with the auth module ON (config root account, DB off), against a PRIVATE
// test instance on the test port serving the BUILT frontend.
//   cd Frontend && npm run build   (first)      cd test && node ui/auth-ui.mjs   (HEADED=1 to watch)

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { makeChecker } from "../lib/checker.mjs";
import { testConfig, startServer, stopServer, BACKEND } from "../lib/backend.mjs";
import { launch, newPage, settle, snap, BROWSER } from "../lib/ui.mjs";

const { check, done } = makeChecker("auth-ui — console gate, sign in, wrong password, sign out");

if (!fs.existsSync(path.join(BACKEND, "public", "dist", "index.html"))) {
    console.log("  FAIL frontend is not built — run `npm run build` in Frontend first");
    console.log("\n1 CHECK(S) FAILED:\n  - Backend/public/dist/index.html missing");
    process.exit(1);
}

const bcrypt = createRequire(path.join(BACKEND, "package.json"))("bcryptjs");
const PASSWORD = "ui-root-password";
const config = testConfig({
    auth: { enabled: true, session: { secret: "u".repeat(40) }, root: { enabled: true, username: "root", password_hash: bcrypt.hashSync(PASSWORD, 4) } },
});

let server;
let browser;
try {
    server = await startServer(config);
    browser = await launch();
    const page = await newPage(browser, { colorScheme: "light" });
    const url = (p) => `${server.base}${p}`;

    await page.goto(url("/console/settings"));
    await page.waitForURL(/\/login\?next=/, { timeout: 8000 });
    check("signed out: the console redirects to /login?next=…", page.url().includes("next=%2Fconsole%2Fsettings"), page.url());
    await page.locator("form").waitFor();
    check("the login form is shown (password method on)", await page.locator("form").isVisible());
    check("no Oteracount button when it isn't configured", (await page.getByRole("button", { name: /Oteracount/ }).count()) === 0);

    await page.click("button[type=submit]");
    check("empty submit shows both field errors", (await page.locator(".field-error").count()) === 2);
    await page.getByLabel("Password", { exact: true }).fill("peek");
    await page.click("button.pw-peek");
    check("the password peek shows the text", (await page.getAttribute("input[autocomplete=current-password]", "type")) === "text");

    await page.getByLabel("Username").fill("root");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText("Wrong username or password").waitFor({ timeout: 8000 });
    check("a wrong password shows the server's message", true);
    await snap(page, "auth-login-error-light-desktop");

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    const loginResponse = page.waitForResponse((r) => r.url().endsWith("/api/auth/login") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Sign in" }).click();
    const setCookie = (await (await loginResponse).allHeaders())["set-cookie"] ?? "";
    await page.waitForURL(/\/console\/settings$/, { timeout: 8000 });
    check("signing in returns to where the visitor was going (next=)", page.url().endsWith("/console/settings"), page.url());
    await settle(page);
    check("the console shows the signed-in user", await page.getByText("root", { exact: true }).first().isVisible());
    await snap(page, "auth-signed-in-light-desktop");

    // What the SERVER sends is the contract — checked in every browser.
    check("the server sets the session cookie HttpOnly + SameSite=Lax",
        setCookie.includes(`${config.app.slug}_session=`) && /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie), setCookie.replace(/=[^;]{12,}/, "=…"));
    // What the browser stored: Playwright's WebKit build for Windows has a cookie store without
    // SameSite support and reports every cookie as "None" (real Safari supports Lax) — skip it there.
    const session = (await page.context().cookies()).find((c) => c.name === `${config.app.slug}_session`);
    if (!(BROWSER === "webkit" && process.platform === "win32")) {
        check("the browser stored it HttpOnly + SameSite=Lax", Boolean(session?.httpOnly) && session?.sameSite === "Lax", JSON.stringify(session ?? null));
    }

    await page.goto(url("/login"));
    await page.waitForURL(/\/console$/, { timeout: 8000 });
    check("visiting /login while signed in goes to the console", page.url().endsWith("/console"));

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForTimeout(500);
    await page.goto(url("/console"));
    await page.waitForURL(/\/login/, { timeout: 8000 });
    check("after sign-out the console is locked again", page.url().includes("/login"));

    await page.goto(url("/login?error=account_disabled"));
    await page.getByText("This account is disabled").waitFor({ timeout: 5000 });
    check("callback errors (?error=) are explained on the login page", true);
} catch (err) {
    check("auth UI drive could run", false, err.stack || err.message);
} finally {
    await browser?.close().catch(() => {});
    await stopServer(server);
}

done();
