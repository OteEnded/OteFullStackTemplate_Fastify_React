// DEMO feature — template items. The whole folder is deletable (the wizard's "remove demo"
// does it); shared files reference it only on lines marked @demo.
import type { StatusMeta } from '../../components/ui/Chip'
import type { SelectOption } from '../../components/ui/Field'

export type ItemStatus = 'draft' | 'active' | 'archived'
export type ItemPriority = 'low' | 'medium' | 'high'

/** One row of mst_template_items, as the API returns it. */
export type TemplateItem = {
  uuid: string
  rolling_id: number
  name: string
  summary: string
  status: ItemStatus
  priority: ItemPriority
  created_at: string
  updated_at: string
}

export type ItemInput = {
  name: string
  summary: string
  status: ItemStatus
  priority: ItemPriority
}

export const STATUS_META: StatusMeta = {
  draft: { tone: 'warn', label: 'Draft' },
  active: { tone: 'ok', label: 'Active' },
  archived: { tone: 'neutral', label: 'Archived' },
}

export const PRIORITY_META: StatusMeta = {
  low: { tone: 'neutral', label: 'Low' },
  medium: { tone: 'info', label: 'Medium' },
  high: { tone: 'danger', label: 'High' },
}

export const STATUS_OPTIONS: SelectOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

export const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]
