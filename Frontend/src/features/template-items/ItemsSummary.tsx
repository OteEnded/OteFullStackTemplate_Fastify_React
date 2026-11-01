import { Link } from 'react-router-dom'
import { Archive, CircleDot, FilePen, ListChecks } from 'lucide-react'
import { errorMessage } from '../../api'
import { Card, Callout, StatCard } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Chip'
import { DataTable } from '../../components/ui/DataTable'
import { fmtAgo, fmtNumber } from '../../lib/format'
import { useLoad } from '../../lib/useLoad'
import { ui } from '../../ui'
import { isDbDisabled, listItems } from './api'
import { DbDisabledCallout } from './DbDisabledCallout'
import { STATUS_META } from './types'

// DEMO dashboard widget: counts by status + the five most recent items.
export function ItemsSummary() {
  const items = useLoad((signal) => listItems({}, signal))
  const rows = items.data ?? []
  const count = (s: string) => rows.filter((r) => r.status === s).length
  const loading = items.loading && !items.data
  const val = (n: number) => (loading ? '…' : fmtNumber(n))

  if (isDbDisabled(items.error)) return <DbDisabledCallout />

  return (
    <>
      <div className={ui.stats}>
        <StatCard icon={ListChecks} label="Items" value={val(rows.length)} hint="latest 200" />
        <StatCard icon={CircleDot} label="Active" value={val(count('active'))} tone="ok" />
        <StatCard icon={FilePen} label="Drafts" value={val(count('draft'))} />
        <StatCard icon={Archive} label="Archived" value={val(count('archived'))} />
      </div>
      {items.error && <Callout tone="danger">Couldn’t load items: {errorMessage(items.error)}</Callout>}
      <Card
        title="Recent items"
        padded={false}
        actions={
          <Link to="/console/items" className="text-sm text-accent-deep hover:underline">
            View all
          </Link>
        }
      >
        <DataTable
          className="rounded-none border-x-0 border-b-0"
          caption="Recent items"
          columns={[
            { key: 'name', header: 'Name', clip: true, render: (r) => r.name },
            { key: 'status', header: 'Status', width: '120px', render: (r) => <StatusBadge value={r.status} meta={STATUS_META} /> },
            { key: 'updated', header: 'Updated', width: '120px', render: (r) => <span className="text-xs text-muted">{fmtAgo(r.updated_at)}</span> },
          ]}
          rows={items.data?.slice(0, 5)}
          rowKey={(r) => r.uuid}
          loading={items.loading}
          minWidth={420}
          empty="No items yet — create one on the Template items page."
        />
      </Card>
    </>
  )
}
