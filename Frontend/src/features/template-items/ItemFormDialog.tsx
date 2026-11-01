import { useState } from 'react'
import { ApiError, errorMessage } from '../../api'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { toast } from '../../lib/toast'
import { createItem, updateItem } from './api'
import { PRIORITY_OPTIONS, STATUS_OPTIONS, type ItemInput, type ItemPriority, type ItemStatus, type TemplateItem } from './types'

// Create / edit in a dialog. Validation mirrors the backend schema (name 1–200 chars, summary
// ≤ 5000) so most mistakes are caught before the request; the server stays the authority —
// its invalid_request message is shown in the dialog, not as a toast.

type Errors = Partial<Record<keyof ItemInput, string>>

function validate(v: ItemInput): Errors {
  const e: Errors = {}
  if (!v.name.trim()) e.name = 'Give the item a name.'
  else if (v.name.length > 200) e.name = 'Keep the name under 200 characters.'
  if (v.summary.length > 5000) e.summary = 'Keep the summary under 5,000 characters.'
  return e
}

export function ItemFormDialog({ item, onClose, onSaved }: { item: TemplateItem | null; onClose: () => void; onSaved: (saved: TemplateItem) => void }) {
  const editing = Boolean(item)
  const [values, setValues] = useState<ItemInput>({
    name: item?.name ?? '',
    summary: item?.summary ?? '',
    status: item?.status ?? 'draft',
    priority: item?.priority ?? 'medium',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = async () => {
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    setServerError('')
    try {
      const body = { ...values, name: values.name.trim() }
      const saved = item ? await updateItem(item.uuid, body) : await createItem(body)
      toast.ok(editing ? 'Changes saved' : 'Item created', saved.name)
      onSaved(saved)
    } catch (err) {
      setServerError(err instanceof ApiError && err.code === 'invalid_request' ? `The server rejected this: ${err.message}` : errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      title={editing ? 'Edit item' : 'New item'}
      description={editing ? `#${item!.rolling_id}` : 'Items are the demo’s example records.'}
      onClose={onClose}
      dismissible={!saving}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {editing ? 'Save changes' : 'Create item'}
          </Button>
        </>
      }
    >
      {serverError && <Callout tone="danger">{serverError}</Callout>}
      <Field label="Name" error={errors.name}>
        <Input value={values.name} onChange={(e) => set('name', e.target.value)} maxLength={200} placeholder="e.g. Weekly digest / สรุปรายสัปดาห์" autoComplete="off" />
      </Field>
      <Field label="Summary" optional error={errors.summary} hint="A sentence or two. Shown in the list.">
        <Textarea value={values.summary} onChange={(e) => set('summary', e.target.value)} rows={3} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          <Select value={values.status} onChange={(e) => set('status', e.target.value as ItemStatus)} options={STATUS_OPTIONS} />
        </Field>
        <Field label="Priority">
          <Select value={values.priority} onChange={(e) => set('priority', e.target.value as ItemPriority)} options={PRIORITY_OPTIONS} />
        </Field>
      </div>
    </Dialog>
  )
}
