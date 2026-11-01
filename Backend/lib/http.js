// Outbound HTTP for calling OTHER services (an auth server, a partner API, a
// sidecar). Every call has a timeout: a dependency that hangs must not hang the
// request that called it (DCON: a stalled lookup froze the dependent site).
// Failures are thrown as UpstreamError with a stable `code`, which the central
// error handler turns into { ok:false, message, code } with the right status.

export class UpstreamError extends Error {
    constructor(message, code, statusCode = 502) {
        super(message);
        this.name = "UpstreamError";
        this.code = code;
        this.statusCode = statusCode;
        this.expose = true; // message names only the target origin — safe to show the client
    }
}

export async function fetchJson(url, { timeoutMs = 5000, ...init } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const target = new URL(url).origin;

    // The timeout covers headers AND body: a server that sends headers and then
    // stalls mid-body must time out too.
    let response;
    let body = null;
    try {
        response = await fetch(url, { ...init, signal: controller.signal });
        const text = await response.text();
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            body = null;
        }
    } catch (err) {
        if (controller.signal.aborted) {
            throw new UpstreamError(`${target} did not answer within ${timeoutMs} ms`, "upstream_timeout", 504);
        }
        throw new UpstreamError(`${target} is unreachable (${err.cause?.code || err.message})`, "upstream_unreachable");
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        throw new UpstreamError(`${target} answered ${response.status}`, "upstream_error");
    }
    return body;
}
