import crypto from "crypto";

// Authenticated encryption (AES-256-GCM) with node:crypto only — no native module, so
// it works in the portable-EXE build (that recipe needs ZERO native modules, which is
// why the template does not use @fastify/secure-session: it depends on sodium-native).
//
// Used for the session cookie (app/modules/auth/session.js) and for any recoverable
// secret an app must store (an upstream API key, an SMTP password): seal it before it
// goes into the database, open it when needed (Otenization's "secret box").
//
//   const box = makeBox(config.security.secret_box_key)
//   const token = box.seal({ any: "json" })   // URL-safe string
//   box.open(token)                            // -> the value, or null if forged / corrupted

const VERSION = "v1";

export function makeBox(secret, purpose = "box") {
    if (typeof secret !== "string" || secret.length < 32) {
        throw new Error(`crypto-box: the ${purpose} secret must be at least 32 characters`);
    }
    // One key per purpose: the same secret never encrypts two kinds of data under one key.
    const key = crypto.createHash("sha256").update(`${purpose}\0${secret}`).digest();

    return {
        seal(value) {
            const iv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
            const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
            return [VERSION, iv.toString("base64url"), body.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
        },
        open(token) {
            try {
                const [version, iv, body, tag] = String(token).split(".");
                if (version !== VERSION) return null;
                const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
                decipher.setAuthTag(Buffer.from(tag, "base64url"));
                const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]);
                return JSON.parse(plain.toString("utf8"));
            } catch {
                return null; // tampered, truncated, wrong key — all mean "not a valid token"
            }
        },
    };
}
