import { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, CirclePlay, ListChecks, Pencil, Plus } from 'lucide-react'
import { errorMessage } from '../../api'
import { Button, IconButton } from '../../components/ui/Button'
import { Callout, EmptyState, PageHeader } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Chip'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { SearchInput, Select } from '../../components/ui/Field'
import { Menu } from '../../components/ui/Menu'
import { RefreshButton, Toolbar } from '../../components/ui/Toolbar'
import { useConfirm } from '../../components/ui/useConfirm'
import { fmtAgo, fmtDateTime } from '../../lib/format'
import { toast } from '../../lib/toast'
import { useLoad } from '../../lib/useLoad'
import { ui } from '../../ui'
import { archiveItem, isDbDisabled, listItems, updateItem } from './api'
import { DbDisabledCallout } from './DbDisabledCallout'
import { ItemFormDialog } from './ItemFormDialog'
import { PRIORITY_META, STATUS_META, STATUS_OPTIONS, type ItemStatus, type TemplateItem } from './types'

// DEMO list page: Toolbar (search, status filter, refresh, New) → DataTable with status
// chips and a "⋯" row menu → create/edit Dialog → Archive through useConfirm → toasts.

export default function ItemsPage() {
  const [status, setStatus] = useState<ItemStatus | ''>('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<TemplateItem | 'new' | null>(null)
  const [confirmEl, confirm] = useConfirm()
  const items = useLoad((signal) => listItems({ status }, signal), [status])

  const dbOff = isDbDisabled(items.error)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !items.data) return items.data
    return items.data.filter((i) => i.name.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q))
  }, [items.data, query])

  const setItemStatus = async (item: TemplateItem, next: ItemStatus) => {
    try {
      await updateItem(item.uuid, { status: next })
      toast.ok(`Marked ${STATUS_META[next].label.toLowerCase()}`, item.name)
      await items.reload()
    } catch (err) {
      toast.error('Could not update the item', errorMessage(err))
    }
  }

  const archive = async (item: TemplateItem) => {
    const ok = await confirm({
      title: `Archive “${item.name}”?`,
      question: 'It leaves the active lists but is kept — you can restore it later.',
      consequences: ['Its status becomes “Archived”.', 'Nothing is deleted (this API has no delete).'],
      confirmLabel: 'Archive',
      tone: 'warn',
    })
    if (!ok) return
    try {
      await archiveItem(item.uuid)
      toast.ok('Item archived', item.name)
      await items.reload()
    } catch (err) {
      toast.error('Could not archive the item', errorMessage(err))
    }
  }

  const columns: Column<TemplateItem>[] = [
    { key: 'id', header: '#', width: '64px', numeric: true, render: (r) => <span className="text-muted">{r.rolling_id}</span> },
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{r.name}</span>
          {r.summary && <span className="truncate text-xs text-muted">{r.summary}</span>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', width: '112px', render: (r) => <StatusBadge value={r.status} meta={STATUS_META} /> },
    { key: 'priority', header: 'Priority', width: '104px', render: (r) => <StatusBadge value={r.priority} meta={PRIORITY_META} /> },
    {
      key: 'updated',
      header: 'Updated',
      width: '140px',
      render: (r) => (
        <time className="text-xs text-muted" dateTime={r.updated_at} title={fmtDateTime(r.updated_at)}>
          {fmtAgo(r.updated_at)}
        </time>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '84px',
      align: 'right',
      render: (r) => (
        <div className={ui.rowActions}>
          <IconButton icon={Pencil} label={`Edit ${r.name}`} size="sm" onClick={() => setEditing(r)} />
          <Menu
            label={`More actions for ${r.name}`}
            items={[
              { label: 'Mark active', icon: CirclePlay, onSelect: () => void setItemStatus(r, 'active'), hidden: r.status === 'active' },
              { label: 'Restore to draft', icon: ArchiveRestore, onSelect: () => void setItemStatus(r, 'draft'), hidden: r.status !== 'archived' },
              'separator',
              { label: 'Archive…', icon: Archive, danger: true, onSelect: () => void archive(r), hidden: r.status === 'archived' },
            ]}
          />
        </div>
      ),
    },
  ]

  return (
    <div className={ui.page}>
      <PageHeader
        title="Template items"
        description="The demo feature: a list, a form dialog, a confirm and toasts — copy its shape, then delete it."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')} disabled={dbOff}>
            New item
          </Button>
        }
      />

      {dbOff ? (
        <DbDisabledCallout />
      ) : (
        <>
          <Toolbar actions={<RefreshButton onRefresh={items.reload} />}>
            <SearchInput
              placeholder="Search items… / ค้นหา"
              aria-label="Search items"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              wrapClassName="w-full sm:w-64"
            />
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ItemStatus | '')}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
              wrapClassName="w-full sm:w-44"
            />
          </Toolbar>

          {items.error && items.data ? <Callout tone="danger">Couldn’t refresh: {errorMessage(items.error)}</Callout> : null}

          <DataTable
            caption="Template items"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.uuid}
            loading={items.loading}
            error={items.error && !items.data ? errorMessage(items.error) : undefined}
            onRowClick={(r) => setEditing(r)}
            minWidth={680}
            empty={
              query || status ? (
                'No items match these filters.'
              ) : (
                <EmptyState icon={ListChecks} title="No items yet" action={<Button icon={Plus} onClick={() => setEditing('new')}>Create the first one</Button>}>
                  Items you create appear here.
                </EmptyState>
              )
            }
          />
        </>
      )}

      {editing && (
        <ItemFormDialog
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void items.reload()
          }}
        />
      )}
      {confirmEl}
    </div>
  )
}
