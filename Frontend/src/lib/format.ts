// Small display formatters (OSM ui.ts). Locale-neutral on purpose: the template has no i18n.

/** "2026-11-02 14:05" in the viewer's local time (sortable, unambiguous). */
export function fmtDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** "3 min ago", "2 h ago", "5 d ago". */
export function fmtAgo(value: string | number | Date | null | undefined, now = Date.now()): string {
  if (value === null || value === undefined || value === '') return '—'
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

/** Seconds → "6 d 4 h" / "3 h 12 min" / "42 s". */
export function fmtUptime(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return '—'
  const s = Math.max(0, Math.floor(totalSeconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d} d ${h} h`
  if (h) return `${h} h ${m} min`
  if (m) return `${m} min`
  return `${s} s`
}

export function fmtNumber(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US')
}
