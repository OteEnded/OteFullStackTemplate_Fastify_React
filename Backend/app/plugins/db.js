import fp from 'fastify-plugin'
import { initDB } from '../../database/index.js'
import { setDB } from '../../lib/utility.js'

export default fp(async function (fastify, opts) {
  const db = await initDB()
  setDB(db)
  fastify.decorate('db', db)

  // Close the connection pool on shutdown, so a stopped server doesn't leave
  // idle connections holding the database open.
  fastify.addHook('onClose', async () => {
    setDB(null)
    await db.sequelize.close()
  })
})
