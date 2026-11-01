import fp from 'fastify-plugin'
import { cronManager } from '../../lib/utility.js'

export default fp(async function (fastify, opts) {

    // cronManager.createJob('example', '*/10 * * * * *', async () => {
    //     fastify.log.info('Cron running...')
    //     // your task here
    // }, { isLog: true })

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
