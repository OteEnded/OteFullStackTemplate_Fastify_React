import exampleItemRoutes from './template-item.route.js' // @demo

export default async function (fastify) {
  // You can add api-level permissions/middleware here in the future
  // fastify.addHook('onRequest', async (request, reply) => {
  //   // Check API access permissions, authentication, etc.
  // })


  // Health in the normal envelope (a special shape forced a special-case client in
  // VOOTED). Names the service, so a check can tell THIS app from an old instance
  // or another app squatting the port. With the DB on, it pings it: db down → 503.
  fastify.get('/health', async (request, reply) => {
    const { name, version, startedAt } = fastify.appInfo
    let db = 'off'
    if (fastify.db?.sequelize) {
      try {
        await Promise.race([
          fastify.db.sequelize.authenticate(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
        ])
        db = 'up'
      } catch {
        db = 'down'
      }
    }
    const data = {
      service: name,
      version,
      uptime_s: Math.round((Date.now() - startedAt.getTime()) / 1000),
      db,
      time: new Date().toISOString(),
    }
    if (db === 'down') {
      return reply.code(503).send({ ok: false, message: 'Database is unreachable', code: 'db_down', data })
    }
    return { ok: true, data }
  })

  // @demo-start — template info for the demo overview page
  fastify.get('/template/meta', async () => {
    const dbEnabled = fastify.config?.database?.enabled !== false

    return {
      ok: true,
      data: {
        name: 'FullStack Template',
        frontend: 'React + Vite',
        backend: 'Fastify + Sequelize',
        databaseEnabled: dbEnabled,
        notes: [
          'Use this workspace as a starting point for a new full-stack project.',
          'Replace the example item feature with your own domain models and routes.',
          'When database.enabled is false, API routes still boot but DB-backed features return setup guidance.',
        ],
      },
    }
  })
  // @demo-end

  await fastify.register(exampleItemRoutes, { prefix: '/template-items' }) // @demo

  // Future: Add other API routes here
  // await fastify.register(otherRoutes, { prefix: '/other' })
}
