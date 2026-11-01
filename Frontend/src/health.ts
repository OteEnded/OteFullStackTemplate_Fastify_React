import { ApiError, getJson } from './api'

// GET /api/health — { service, version, uptime_s, db: 'off' | 'up' | 'down', time }.
// With the DB down the backend answers 503 but still sends `data`; surface it as a value.
export type Health = {
  service: string
  version: string
  uptime_s: number
  db: 'off' | 'up' | 'down'
  time: string
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  try {
    return await getJson<Health>('/api/health', { signal })
  } catch (err) {
    if (err instanceof ApiError && err.code === 'db_down') {
      const data = (err.body as { data?: Health } | null)?.data
      if (data) return data
    }
    throw err
  }
}
