import { Activity, Database, Server, Timer } from 'lucide-react'
import { errorMessage } from '../api'
import { getAppConfig } from '../config'
import { getHealth } from '../health'
import { Callout, PageHeader, StatCard } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { RefreshButton } from '../components/ui/Toolbar'
import { fmtUptime } from '../lib/format'
import { useLoad } from '../lib/useLoad'
import { ui } from '../ui'
import { ItemsSummary } from '../features/template-items/ItemsSummary' // @demo

// Console home: server health (polled every 30 s) + the demo's widget. Replace the widget
// with your project's own numbers.

const DB_LABEL = { off: 'Off', up: 'Up', down: 'Down' } as const

export default function DashboardPage() {
  const { name } = getAppConfig().app
  const health = useLoad((signal) => getHealth(signal), [], { pollMs: 30_000 })
  const h = health.data
  const dash = (v: string | undefined) => (h ? v : health.loading ? '…' : '—')

  return (
    <div className={ui.page}>
      <PageHeader
        kicker={name}
        title="Dashboard"
        description="What's running and how it's doing."
        actions={<RefreshButton onRefresh={health.reload} label="Refresh health" />}
      />

      {health.error ? <Callout tone="danger" title="The server didn’t answer the health check">{errorMessage(health.error)}</Callout> : null}

      <section aria-label="Server" className={ui.stats}>
        <StatCard icon={Server} label="Service" value={<span className="text-lg">{dash(h?.service)}</span>} hint={h ? `version ${h.version}` : undefined} />
        <StatCard icon={Timer} label="Uptime" value={dash(h ? fmtUptime(h.uptime_s) : undefined)} hint="since the last restart" />
        <StatCard
          icon={Database}
          label="Database"
          value={dash(h ? DB_LABEL[h.db] : undefined)}
          tone={h?.db === 'up' ? 'ok' : h?.db === 'down' ? 'danger' : undefined}
          hint={h?.db === 'off' ? 'database.enabled is false' : undefined}
        />
        <StatCard
          icon={Activity}
          label="API"
          value={
            h ? (
              <Chip tone="ok" dot>
                Healthy
              </Chip>
            ) : (
              dash(undefined)
            )
          }
          hint="GET /api/health"
        />
      </section>

      {/* @demo-start */}
      <section aria-label="Template items" className="flex flex-col gap-3">
        <h2 className={ui.sectionTitle}>Template items</h2>
        <ItemsSummary />
      </section>
      {/* @demo-end */}
    </div>
  )
}
