import fp from 'fastify-plugin'
import { logRequest, getRequestLogContentOptions, redactHeaders, redactBody, redactUrl } from '../../lib/utility.js'

// One record per request, written when the response is DONE (onResponse) — so it
// can carry the status and duration, and the body is already parsed. (The old hook
// ran at onRequest, before body parsing, so request_body was always {}.)
// Headers, query strings and bodies are opt-in (logging.request.log_headers /
// log_query / log_body) and always pass through the redaction helpers.
export default fp(async function (fastify) {
  fastify.addHook('onResponse', async (request, reply) => {
    const { logHeaders, logQuery, logBody } = getRequestLogContentOptions()

    const requestData = {
      request_at: new Date(Date.now() - reply.elapsedTime),
      request_ip: request.ip || request.socket?.remoteAddress || 'unknown',
      request_to: redactUrl(request.url, logQuery),
      request_protocol: request.protocol,
      request_method: request.method,
      response_status: reply.statusCode,
      duration_ms: Math.round(reply.elapsedTime * 10) / 10,
      request_header: logHeaders ? redactHeaders(request.headers) : null,
      request_body: logBody && request.body !== undefined ? redactBody(request.body) : null
    }

    // Log asynchronously without blocking the response
    logRequest(requestData).catch((err) => {
      console.error('Error logging request:', err)
    })
  })
})
