import { useState } from 'react'
import { Archive, Bell, Copy, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../components/ui/Button'
import { Callout, Card, EmptyState, PageHeader, StatCard } from '../components/ui/Card'
import { Chip, StatusBadge, type StatusMeta } from '../components/ui/Chip'
import { CopyButton } from '../components/ui/CopyButton'
import { DataTable } from '../components/ui/DataTable'
import { Dialog } from '../components/ui/Dialog'
import { Checkbox, Field, Input, SearchInput, Select, Switch, Textarea } from '../components/ui/Field'
import { Menu } from '../components/ui/Menu'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Skeleton, Spinner } from '../components/ui/Spinner'
import { Tabs } from '../components/ui/Tabs'
import { RefreshButton, Toolbar } from '../components/ui/Toolbar'
import { useConfirm } from '../components/ui/useConfirm'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { toast } from '../lib/toast'
import { ui } from '../ui'

// DEV ONLY (/console/ui, behind import.meta.env.DEV — absent from the production build).
// Every component in every tone on one page, so one screenshot per theme reviews the kit.

const META: StatusMeta = {
  ok: { tone: 'ok', label: 'Healthy' },
  warn: { tone: 'warn', label: 'Degraded' },
  danger: { tone: 'danger', label: 'Down' },
  info: { tone: 'info', label: 'Syncing' },
  think: { tone: 'think', label: 'Queued' },
  neutral: { tone: 'neutral', label: 'Archived' },
}

type Row = { id: number; name: string; state: keyof typeof META; count: number }
const ROWS: Row[] = [
  { id: 1042, name: 'Quarterly report export', state: 'ok', count: 1284 },
  { id: 1041, name: 'รายงานประจำเดือน ตุลาคม', state: 'warn', count: 32 },
  { id: 1040, name: 'Sync partner catalogue', state: 'danger', count: 0 },
  { id: 1039, name: 'Archive old sessions', state: 'neutral', count: 7 },
]

const SERIES = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8']

export default function KitchenSinkPage() {
  const [dialog, setDialog] = useState(false)
  const [tab, setTab] = useState('one')
  const [confirmEl, confirm] = useConfirm()
  const [on, setOn] = useState(true)

  return (
    <div className={ui.page}>
      <PageHeader kicker="Dev only" title="UI kit" description="Every component, every tone — check both themes and a phone width before shipping a change." actions={<ThemeToggle showLabel />} />

      <Card title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={Plus}>Primary</Button>
          <Button icon={Save}>Default</Button>
          <Button variant="warn" icon={Archive}>Warn</Button>
          <Button variant="danger" icon={Trash2}>Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" icon={Pencil}>Small</Button>
          <IconButton icon={Bell} label="Notifications" />
          <IconButton icon={Copy} label="Copy" variant="default" size="sm" />
          <CopyButton text="kitchen-sink" />
          <RefreshButton onRefresh={() => new Promise((r) => setTimeout(r, 300))} />
          <Menu
            items={[
              { label: 'Edit', icon: Pencil, onSelect: () => toast.info('Edit chosen') },
              { label: 'Duplicate', icon: Copy, onSelect: () => toast.info('Duplicate chosen') },
              'separator',
              { label: 'Delete…', icon: Trash2, danger: true, onSelect: () => toast.warn('Delete chosen') },
            ]}
          />
        </div>
      </Card>

      <Card title="Form controls">
        <div className={ui.grid2}>
          <Field label="Name" hint="Shown in lists.">
            <Input placeholder="e.g. Weekly digest / สรุปรายสัปดาห์" />
          </Field>
          <Field label="With an error" error="Give the item a name.">
            <Input defaultValue="" />
          </Field>
          <Field label="Password">
            <PasswordInput defaultValue="correct horse" autoComplete="off" />
          </Field>
          <Field label="Status">
            <Select options={[{ value: 'a', label: 'Active' }, { value: 'd', label: 'Draft' }]} />
          </Field>
          <Field label="Summary" optional className="sm:col-span-2">
            <Textarea rows={2} placeholder="A sentence or two." />
          </Field>
          <div className="flex flex-wrap items-center gap-5">
            <Checkbox label="Checkbox" defaultChecked />
            <Switch label={on ? 'Switch on' : 'Switch off'} checked={on} onChange={(e) => setOn(e.target.checked)} />
            <Switch label="Disabled" disabled />
          </div>
          <SearchInput placeholder="Search…" aria-label="Search" />
        </div>
      </Card>

      <Card title="Chips, callouts, stats">
        <div className="flex flex-wrap gap-2">
          {Object.keys(META).map((k) => (
            <StatusBadge key={k} value={k} meta={META} />
          ))}
          <Chip tone="accent">accent</Chip>
          <Chip>plain</Chip>
          <span className="kbd">Ctrl</span>
          <span className="kbd">K</span>
        </div>
        <div className="flex flex-col gap-2">
          <Callout tone="info" title="Info">The demo feature can be deleted by the wizard. — ฟีเจอร์ตัวอย่าง ลบได้ด้วยวิซาร์ด</Callout>
          <Callout tone="ok">Saved. Everything is up to date.</Callout>
          <Callout tone="warn" title="Restart needed">Changing the port needs a restart. ต้องรีสตาร์ทเซิร์ฟเวอร์</Callout>
          <Callout tone="danger" title="Couldn’t save">The server rejected this: name must not be blank.</Callout>
        </div>
        <div className={ui.stats}>
          <StatCard label="Items" value="1,284" hint="+32 this week" />
          <StatCard label="Errors (24 h)" value="3" tone="danger" hint="all invalid_request" />
          <StatCard label="Uptime" value="6 d 4 h" tone="ok" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {SERIES.map((s) => (
            <span key={s} className="h-4 w-8 rounded-sm" style={{ background: `var(${s})` }} title={s} />
          ))}
          <span className="ml-2 text-xs text-muted">--series-1…8</span>
        </div>
      </Card>

      <Card title="Table">
        <Toolbar actions={<Button variant="primary" size="sm" icon={Plus}>New</Button>}>
          <SearchInput placeholder="Filter…" aria-label="Filter" wrapClassName="w-full sm:w-56" />
        </Toolbar>
        <DataTable
          caption="Sample rows"
          columns={[
            { key: 'id', header: '#', width: '70px', numeric: true, render: (r) => r.id },
            { key: 'name', header: 'Name', clip: true, render: (r) => r.name, dim: (r) => r.state === 'neutral' },
            { key: 'state', header: 'State', width: '120px', render: (r) => <StatusBadge value={r.state} meta={META} /> },
            { key: 'count', header: 'Count', width: '90px', numeric: true, render: (r) => r.count.toLocaleString('en-US') },
            { key: 'menu', header: <span className="sr-only">Actions</span>, width: '56px', align: 'right', render: () => <Menu items={[{ label: 'Edit', onSelect: () => {} }]} /> },
          ]}
          rows={ROWS}
          rowKey={(r) => String(r.id)}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <DataTable caption="Loading" columns={[{ key: 'a', header: 'Loading state', render: () => null }]} rows={undefined} rowKey={() => ''} loading minWidth={300} />
          <DataTable caption="Empty" columns={[{ key: 'a', header: 'Empty state', render: () => null }]} rows={[]} rowKey={() => ''} minWidth={300} />
        </div>
      </Card>

      <Card title="Overlays & feedback">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog(true)}>Open dialog</Button>
          <Button
            variant="danger"
            onClick={async () => {
              const ok = await confirm({ title: 'Delete “Sync partner catalogue”?', question: 'This removes it for everyone.', consequences: ['Its history is deleted.', 'Links to it stop working.'], confirmLabel: 'Delete', tone: 'danger', typeToConfirm: 'delete' })
              toast[ok ? 'ok' : 'info'](ok ? 'Deleted (not really)' : 'Kept')
            }}
          >
            Confirm (type-to-confirm)
          </Button>
          <Button onClick={() => toast.ok('Saved', 'บันทึกแล้ว')}>Toast ok</Button>
          <Button onClick={() => toast.info('Heads up')}>Toast info</Button>
          <Button onClick={() => toast.warn('Running low', 'Disk at 85%')}>Toast warn</Button>
          <Button onClick={() => toast.error('Couldn’t save', 'The server is unreachable.')}>Toast error</Button>
        </div>
        <div className="flex items-center gap-4">
          <Spinner />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton width="60%" />
            <Skeleton width="35%" />
          </div>
        </div>
        <Tabs label="Example tabs" value={tab} onChange={setTab} items={[{ value: 'one', label: 'Overview' }, { value: 'two', label: 'Details' }, { value: 'three', label: 'History' }]}>
          <p className="text-sm text-muted">Panel “{tab}”. Arrow keys move between tabs.</p>
        </Tabs>
        <EmptyState icon={Archive} title="Nothing archived" action={<Button size="sm">Browse items</Button>}>
          Archived items show up here.
        </EmptyState>
      </Card>

      {dialog && (
        <Dialog
          title="Dialog title"
          description="Native <dialog>: Esc closes, a drag that ends on the backdrop doesn't."
          onClose={() => setDialog(false)}
          onSubmit={() => {
            toast.ok('Submitted')
            setDialog(false)
          }}
          footer={
            <>
              <Button onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save</Button>
            </>
          }
        >
          <Field label="Name">
            <Input placeholder="Type, then press Enter" />
          </Field>
          <Callout tone="info">Toasts render above an open dialog.</Callout>
        </Dialog>
      )}
      {confirmEl}
    </div>
  )
}
