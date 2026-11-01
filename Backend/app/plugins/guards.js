import fp from 'fastify-plugin'

// ⭐ GET + POST only. Ote, 2026-11-01: "i like GET+POST-only style ... i think this
// is commom pattern". Updates and actions are POST /:uuid or POST /:uuid/<action>.
// Apps built from the template drifted to PATCH/PUT/DELETE because coding agents
// write REST verbs by habit — so the rule is ENFORCED here, at boot, not just
// written down. HEAD (auto-added for GET) and OPTIONS (CORS preflight) are fine.
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'OPTIONS'])

// State-changing requests (POST) whose Origin header names another site are
// refused: a browser always sends Origin on a cross-site POST, so this blocks
// cross-site request forgery without tokens. Requests WITHOUT an Origin (curl,
// server-to-server, same-origin GET navigations) are not browser cross-site
// requests and pass. Extra trusted origins: app.public_origins in config.json.
function sameOrigin(origin, request) {
  try {
    const originUrl = new URL(origin)
    // Parse Host with the origin's scheme so default ports compare equal
    // ("localhost:80" vs "http://localhost", "x:443" vs "https://x").
    const hostUrl = new URL(`${originUrl.protocol}//${request.headers.host}`)
    return originUrl.host === hostUrl.host
  } catch {
    return false
  }
}

export default fp(async function guards(fastify) {
  fastify.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method]
    const bad = methods.filter((method) => !ALLOWED_METHODS.has(String(method).toUpperCase()))
    if (bad.length > 0) {
      throw new Error(
        `Route ${bad.join('/')} ${route.url} is not allowed: this app's API is GET + POST only ` +
        `(use POST ${route.url} or POST ${route.url}/<action> instead). See AI_CarryOn.md standing rules.`
      )
    }
  })

  const trustedOrigins = new Set(fastify.config?.app?.public_origins ?? [])

  fastify.addHook('onRequest', async (request, reply) => {
    if (request.method !== 'POST') return
    const origin = request.headers.origin
    if (!origin) return // not a browser cross-site request; "null" (sandboxed/file://) falls through and is refused
    if (sameOrigin(origin, request) || trustedOrigins.has(origin)) return
    return reply.code(403).send({ ok: false, message: 'Cross-site request refused', code: 'forbidden_origin' })
  })
})
