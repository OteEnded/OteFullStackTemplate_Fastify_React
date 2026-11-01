import { CHOICES } from '../../../database/models/index.js'

// Example feature — replace with your own domain. It shows the template's API
// conventions in one place:
//   - GET to read, POST to create AND to update (GET + POST only — enforced at boot)
//   - JSON schemas validate input BEFORE the handler runs; a bad request becomes
//     { ok:false, message, code:'invalid_request', details } via the error handler
//   - every reply is { ok:true, data } or { ok:false, message, code }

function ensureTemplateItemsModel(fastify, reply) {
  if (!fastify.db?.mst_template_items) {
    reply.code(503).send({
      ok: false,
      message: 'The demo table is unavailable. Enable and configure the database in config.json.',
      code: 'db_disabled',
    })
    return null
  }

  return fastify.db.mst_template_items
}

const itemFields = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  summary: { type: 'string', maxLength: 5000 },
  status: { type: 'string', enum: CHOICES.mst_template_items_status },
  priority: { type: 'string', enum: CHOICES.mst_template_items_priority },
}

const listQuery = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: CHOICES.mst_template_items_status },
    limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
  },
}

const createBody = {
  type: 'object',
  required: ['name'],
  additionalProperties: false, // unknown fields are stripped (Fastify's default removeAdditional)
  properties: itemFields,
}

const updateBody = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: itemFields,
}

// A malformed id is rejected with a 400 BEFORE it reaches Postgres — otherwise the
// uuid cast fails (22P02) and leaks as a 500.
const uuidParams = {
  type: 'object',
  required: ['uuid'],
  properties: { uuid: { type: 'string', format: 'uuid' } },
}

export default async function templateItemRoutes(fastify) {
  fastify.get('/', { schema: { querystring: listQuery } }, async (request, reply) => {
    const TemplateItems = ensureTemplateItemsModel(fastify, reply)
    if (!TemplateItems) {
      return
    }

    const { status, limit } = request.query
    const rows = await TemplateItems.findAll({
      where: status ? { status } : {},
      order: [['updated_at', 'DESC']],
      limit,
    })

    return reply.send({ ok: true, data: rows })
  })

  fastify.post('/', { schema: { body: createBody } }, async (request, reply) => {
    const TemplateItems = ensureTemplateItemsModel(fastify, reply)
    if (!TemplateItems) {
      return
    }

    const { name, summary = '', status = 'draft', priority = 'medium' } = request.body
    if (!name.trim()) {
      return reply.code(400).send({ ok: false, message: 'name must not be blank', code: 'invalid_request' })
    }

    const row = await TemplateItems.create({ name, summary: summary.trim(), status, priority })
    return reply.code(201).send({ ok: true, data: row })
  })

  // Update via POST /:uuid (GET + POST only — there is no PATCH/PUT here by design).
  fastify.post('/:uuid', { schema: { params: uuidParams, body: updateBody } }, async (request, reply) => {
    const TemplateItems = ensureTemplateItemsModel(fastify, reply)
    if (!TemplateItems) {
      return
    }

    const row = await TemplateItems.findByPk(request.params.uuid)
    if (!row) {
      return reply.code(404).send({ ok: false, message: 'item not found', code: 'not_found' })
    }

    const { name, summary, status, priority } = request.body
    if (name !== undefined && !name.trim()) {
      return reply.code(400).send({ ok: false, message: 'name must not be blank', code: 'invalid_request' })
    }

    await row.update({
      ...(name !== undefined && { name }),
      ...(summary !== undefined && { summary: summary.trim() }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
    })

    return reply.send({ ok: true, data: row })
  })
}
