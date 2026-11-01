import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyCors from '@fastify/cors'
import fs from 'fs'
import { randomBytes } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { log } from './lib/utility.js'

import guardsPlugin from './app/plugins/guards.js'
import errorHandlerPlugin from './app/plugins/error-handler.js'
import requestLoggerPlugin from './app/plugins/request-logger.js'
import dbPlugin from './app/plugins/db.js'
import cronPlugin from './app/plugins/cron.js'
import websocketPlugin from './app/plugins/websocket.js'
import routes from './app/routes/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(join(__dirname, 'package.json'), 'utf-8'))

// Builds the whole app WITHOUT listening, so it can be started by server.js or
// driven in-process by tests (`const app = await buildApp(config); app.inject(...)`).
// `overrides` is for tests only: { logger, database: false }.
export async function buildApp(config, overrides = {}) {
  const app = config.app ?? {}

  const fastify = Fastify({
    logger: overrides.logger ?? (config.logging?.fastify || false),
    // Behind nginx/Cloudflare, request.ip is the PROXY's address unless the proxy
    // is trusted — which broke rate limits and Secure cookies (Portal). Set
    // app.trust_proxy to the proxy's address or a hop count; default: trust none.
    trustProxy: app.trust_proxy ?? false,
    bodyLimit: Math.round((app.body_limit_mb ?? 1) * 1024 * 1024),
    genReqId: () => randomBytes(6).toString('hex'),
  })

  fastify.decorate('config', config)
  fastify.decorate('appInfo', { name: app.name || pkg.name, version: pkg.version, startedAt: new Date() })

  // Guards FIRST: its onRoute hook must see every route registered after it.
  await fastify.register(guardsPlugin)
  await fastify.register(errorHandlerPlugin)

  // Same origin needs no CORS at all (Fastify serves the frontend itself). Only the
  // origins listed in app.public_origins may call the API from another site.
  const publicOrigins = app.public_origins ?? []
  await fastify.register(fastifyCors, {
    origin: publicOrigins.length > 0 ? publicOrigins : false,
    methods: ['GET', 'POST'],
    credentials: publicOrigins.length > 0,
  })

  await fastify.register(requestLoggerPlugin)

  // Backward compatible: if `database.enabled` is not set, DB is considered enabled.
  const shouldUseDatabase = overrides.database !== false && config.database?.enabled !== false
  if (shouldUseDatabase) {
    await fastify.register(dbPlugin)
    await log(`Database plugin registered`, import.meta.url)
  } else {
    await log(`Database plugin skipped (database.enabled=false)`, import.meta.url)
  }

  await fastify.register(cronPlugin)
  await fastify.register(websocketPlugin)

  const distDir = join(__dirname, 'public', 'dist')
  if (fs.existsSync(distDir)) {
    await fastify.register(fastifyStatic, { root: distDir, prefix: '/' })
  } else {
    await log.warning(`Frontend not built (${distDir} missing) — API only. Run the frontend build.`, import.meta.url)
  }

  await fastify.register(routes)
  return fastify
}
