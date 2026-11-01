// Request logs must never keep secrets — the template used to store every header
// and cookie verbatim (found in OLS, DCON, Portal, OSM, Otenization).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { testConfig, loadBackend } from "../lib/backend.mjs";

let utility;
before(async () => {
    ({ utility } = await loadBackend(testConfig()));
});

test("secret headers are redacted, ordinary ones kept", () => {
    const out = utility.redactHeaders({
        "user-agent": "curl",
        authorization: "Bearer T",
        cookie: "sid=S",
        "set-cookie": "a=b",
        "x-api-key": "K",
        "x-myapp-token": "Z",
        "content-type": "application/json",
    });
    assert.equal(out["user-agent"], "curl");
    assert.equal(out["content-type"], "application/json");
    for (const name of ["authorization", "cookie", "set-cookie", "x-api-key", "x-myapp-token"]) {
        assert.equal(out[name], "[redacted]", name);
    }
});

test("secret-named body fields are redacted at any depth", () => {
    const out = utility.redactBody({ name: "a", password: "p", nested: { apiKey: "k", list: [{ token: "t", ok: 1 }] } });
    assert.deepEqual(out, { name: "a", password: "[redacted]", nested: { apiKey: "[redacted]", list: [{ token: "[redacted]", ok: 1 }] } });
});

test("query strings are omitted by default; OAuth code/state redacted when kept", () => {
    assert.equal(utility.redactUrl("/x?a=1", false), "/x?[query omitted]");
    assert.equal(utility.redactUrl("/plain", false), "/plain");
    const kept = utility.redactUrl("/cb?code=ABC&state=S&page=2", true);
    assert.doesNotMatch(kept, /ABC|=S&/);
    assert.match(kept, /page=2/);
});
