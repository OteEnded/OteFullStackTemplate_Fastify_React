// Process entry point: load config → check it → build the app → listen → handle
// shutdown. The app itself is built in app.js (so tests can build it without a port).
//
//   node server.js                      uses Backend/config.json
//   node server.js --config other.json  a second instance on another config (tests)
import { loadConfig, getConfigPath, logInit, requestLogInit, queryLogInit, log } from './lib/utility.js'
import { checkConfig } from './lib/config-check.js'
import { buildApp } from './app.js'

const SHUTDOWN_GRACE_MS = 10_000

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index > -1 ? process.argv[index + 1] : undefined
}

async function main() {
  let config
  try {
    config = loadConfig(argValue('--config'))
  } catch (err) {
    console.error(`\n  Cannot start: ${err.message}\n`)
    process.exit(1)
  }

  // Refuse to start on an unsafe or half-filled config, listing EVERY problem.
  const problems = checkConfig(config)
  if (problems.length > 0) {
    console.error(`\n  Cannot start — ${problems.length} problem(s) in ${getConfigPath()}:\n`)
    for (const problem of problems) console.error(`    - ${problem}`)
    console.error('')
    process.exit(1)
  }

  const env = process.env.NODE_ENV || 'development'
  // The port comes from config ONLY (no PORT env override): config.json is the one
  // source of truth — launch scripts and OteServerManager read app.port from it.
  const port = config.app.port
  // Loopback by default: reachable from this machine only. Set app.host to
  // "0.0.0.0" deliberately to serve the LAN (the old hard-coded 0.0.0.0 exposed
  // every app on every interface — LAN, VPN, virtual adapters).
  const host = config.app.host || '127.0.0.1'

  const logPath = logInit()
  if (logPath) console.log(`Message log file: ${logPath}`)
  const requestLogPath = requestLogInit()
  if (requestLogPath) console.log(`Request log file: ${requestLogPath}`)
  if (config.database?.enabled !== false) {
    const queryLogPath = queryLogInit()
    if (queryLogPath) console.log(`Query log file: ${queryLogPath}`)
  }

  await log(`Starting in ${env} with ${getConfigPath()}`, import.meta.url)
  const fastify = await buildApp(config)

  try {
    await fastify.listen({ port, host })
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      // Say it loudly: an OLD instance on this port keeps answering /api/health
      // with 200 while this new one has died — easy to mistake for a good start.
      console.error(`\n  ✖ Port ${port} is already in use on ${host}.`)
      console.error(`    Another instance of this app (or another app) is running there.`)
      console.error(`    Stop it first, or change app.port in ${getConfigPath()}. NOT started.\n`)
      await log.error(`Port ${port} in use — not started`, import.meta.url)
      process.exit(2)
    }
    throw err
  }

  await log(`Listening on http://${host}:${port}`, import.meta.url)
  console.log(`Running in ${env} at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)

  // Graceful shutdown: close the server so onClose hooks run (cron jobs stop, DB
  // pool closes, sockets end). No app built from the template did this before.
  // SIGINT = Ctrl+C · SIGTERM = service managers / Linux · SIGHUP = the Windows
  // console window was closed · SIGBREAK = Ctrl+Break on Windows.
  let shuttingDown = false
  const shutdown = async (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    await log(`${signal} received — shutting down`, import.meta.url)
    const force = setTimeout(() => {
      console.error(`Shutdown took longer than ${SHUTDOWN_GRACE_MS} ms — forcing exit`)
      process.exit(1)
    }, SHUTDOWN_GRACE_MS)
    force.unref()
    try {
      await fastify.close()
      process.exit(0)
    } catch (err) {
      console.error('Error during shutdown:', err)
      process.exit(1)
    }
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.on(signal, () => void shutdown(signal))
  }
}

// A crash must end the process with a NON-zero code, so a launcher or service
// manager (e.g. OteServerManager) sees a failure instead of a clean stop.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err)
  process.exit(1)
})

main().catch((err) => {
  console.error('Fatal error during startup:', err)
  process.exit(1)
})
