import fp from 'fastify-plugin'
import { log } from '../../lib/utility.js'

// ONE error shape for the whole app: { ok: false, message, code } (+ details for
// validation, + request_id for server errors). `code` is a stable, machine-
// readable string the frontend can branch on; `message` is for humans.
// Without this, Fastify answered validation/parse errors in its own shape and
// 500s were logged nowhere (OSM, DCON, Bloteb).

const FASTIFY_CODES = {
  FST_ERR_CTP_EMPTY_JSON_BODY: 'invalid_request',
  FST_ERR_CTP_INVALID_JSON_BODY: 'invalid_request',
  FST_ERR_CTP_INVALID_MEDIA_TYPE: 'unsupported_media_type',
  FST_ERR_CTP_BODY_TOO_LARGE: 'payload_too_large',
  FST_ERR_NOT_FOUND: 'not_found',
}

export default fp(async function errorHandler(fastify) {
  fastify.setErrorHandler(async (error, request, reply) => {
    // A handler that failed after setting file headers (download, image) must not
    // send the JSON error under them.
    reply.removeHeader('content-disposition')
    reply.removeHeader('content-length')
    reply.type('application/json; charset=utf-8')

    if (error.validation) {
      return reply.code(400).send({
        ok: false,
        message: error.message,
        code: 'invalid_request',
        details: error.validation.map((v) => ({
          field: v.instancePath || v.params?.missingProperty || error.validationContext,
          message: v.message,
        })),
      })
    }

    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500

    if (status < 500) {
      return reply.code(status).send({
        ok: false,
        message: error.message,
        code: FASTIFY_CODES[error.code] || (typeof error.code === 'string' && !error.code.startsWith('FST_') ? error.code : 'bad_request'),
      })
    }

    // Server errors: full detail goes to the log, a generic message to the client
    // (stack traces and SQL errors are not for visitors). request_id links the two.
    // An error marked `expose = true` was written to be client-safe (e.g.
    // UpstreamError in lib/http.js) and keeps its own message and code.
    await log.error(
      `[${request.id}] ${request.method} ${request.url.split('?')[0]} -> ${status}: ${error.stack || error.message}`,
      import.meta.url
    )
    if (error.expose === true) {
      return reply.code(status).send({ ok: false, message: error.message, code: error.code || 'internal_error', request_id: request.id })
    }
    return reply.code(status).send({
      ok: false,
      message: 'Internal server error',
      code: 'internal_error',
      request_id: request.id,
    })
  })
})
