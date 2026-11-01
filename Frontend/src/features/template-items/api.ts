import { ApiError, getJson, postJson } from '../../api'
import type { ItemInput, ItemStatus, TemplateItem } from './types'

// The demo's API calls — GET to read, POST to create AND to update (GET + POST only).
const BASE = '/api/template-items'

export function listItems({ status, limit = 200 }: { status?: ItemStatus | ''; limit?: number } = {}, signal?: AbortSignal) {
  const q = new URLSearchParams({ limit: String(limit) })
  if (status) q.set('status', status)
  return getJson<TemplateItem[]>(`${BASE}?${q}`, { signal })
}

export function createItem(input: ItemInput) {
  return postJson<TemplateItem>(BASE, input)
}

export function updateItem(uuid: string, patch: Partial<ItemInput>) {
  return postJson<TemplateItem>(`${BASE}/${encodeURIComponent(uuid)}`, patch)
}

/** There is no delete in this API: "archive" is an update of the status. */
export function archiveItem(uuid: string) {
  return updateItem(uuid, { status: 'archived' })
}

/** The backend answers 503 db_disabled while the database is off — a setup state, not a failure. */
export function isDbDisabled(err: unknown) {
  return err instanceof ApiError && err.code === 'db_disabled'
}
