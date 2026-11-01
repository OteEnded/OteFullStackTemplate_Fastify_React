import fp from 'fastify-plugin'
import { cronManager, log } from '../../lib/utility.js'
import { pruneLogs } from '../../lib/retention.js'

export default fp(async function (fastify, opts) {

    // cronManager.createJob('example', '*/10 * * * * *', async () => {
    //     // your task here — jobs are guarded: a throw is logged, the server keeps running
    // }, { isLog: true })

    // Built-in: log retention (logging.retention_days; 0 = keep forever). Daily at
    // 03:15, plus once at startup so a long-stopped server cleans up when it returns.
    const retentionDays = fastify.config?.logging?.retention_days
    if (retentionDays > 0) {
        const prune = async () => {
            const { files, rows } = await pruneLogs(fastify.config, fastify.db)
            if (files || rows) await log(`Log retention (${retentionDays} days): removed ${files} file(s), ${rows} row(s)`, import.meta.url)
        }
        if (!cronManager.jobs.has('log-retention')) {
            cronManager.createJob('log-retention', '15 3 * * *', prune)
        }
        fastify.addHook('onReady', async () => {
            prune().catch((err) => log(`Log retention failed: ${err.message}`, 'error', import.meta.url))
        })
    }

    // Lifecycle hooks are ON (no-ops while there are no jobs): jobs start once the
    // server is ready and stop on shutdown — server.js closes Fastify on
    // Ctrl+C / SIGTERM / console close, so onClose really runs now.
    fastify.addHook('onReady', async () => {
        cronManager.startAll()
    })

    fastify.addHook('onClose', async () => {
        cronManager.stopAll()
    })

    // Decorate fastify with cronManager for easy access
    fastify.decorate('cronManager', cronManager)

})
