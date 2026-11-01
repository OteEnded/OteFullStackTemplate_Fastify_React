// In-memory failure rate limiting for sign-in (lifted from OteRM, which copied OteLLMServices).
//
// Sliding-window FAILURE counters keyed by caller-chosen strings (ip / ip+username). Only
// failures count; a successful sign-in clears its bucket, so the owner never hits the wall.
// In-memory on purpose (single process): a restart resets the counters.

const buckets = new Map(); // key -> { count, windowStart, lockedUntil }
const MAX_BUCKETS = 10000; // memory backstop; prune expired before evicting anything live

function prune(windowMs) {
    if (buckets.size < MAX_BUCKETS) return;
    const now = Date.now();
    for (const [key, b] of buckets) {
        if ((b.lockedUntil || 0) < now && now - b.windowStart > windowMs) buckets.delete(key);
    }
}

export function makeLimiter({ maxFailures = 8, windowMs = 15 * 60 * 1000, lockoutMs = null } = {}) {
    return {
        // -> { limited: boolean, retryAfterSeconds?: number }
        check(key) {
            const b = buckets.get(key);
            if (!b) return { limited: false };
            const now = Date.now();
            if (b.lockedUntil && b.lockedUntil > now) {
                return { limited: true, retryAfterSeconds: Math.ceil((b.lockedUntil - now) / 1000) };
            }
            if (now - b.windowStart > windowMs) buckets.delete(key);
            return { limited: false };
        },
        recordFailure(key) {
            prune(windowMs);
            const now = Date.now();
            let b = buckets.get(key);
            if (!b || now - b.windowStart > windowMs) {
                b = { count: 0, windowStart: now, lockedUntil: 0 };
                buckets.set(key, b);
            }
            b.count += 1;
            if (b.count >= maxFailures) b.lockedUntil = now + (lockoutMs ?? windowMs);
        },
        clear(key) {
            buckets.delete(key);
        },
    };
}

// Test hook.
export function resetAllLimits() {
    buckets.clear();
}
