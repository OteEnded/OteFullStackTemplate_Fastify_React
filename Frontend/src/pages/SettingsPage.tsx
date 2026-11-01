import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Monitor, Moon, Sun } from 'lucide-react'
import { errorMessage } from '../api'
import { getAppConfig } from '../config'
import { getHealth } from '../health'
import { Callout, Card, PageHeader } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { CopyButton } from '../components/ui/CopyButton'
import { Icon } from '../components/ui/Icon'
import { Skeleton } from '../components/ui/Spinner'
import { Tabs } from '../components/ui/Tabs'
import { fmtDateTime, fmtUptime } from '../lib/format'
import { useTheme, type ThemePref } from '../lib/theme'
import { useLoad } from '../lib/useLoad'
import { ui } from '../ui'

// Settings: Appearance (theme radio) + About (from /api/health). The tab is in the URL
// (?tab=about) so a reload or a shared link lands on the same tab.

const THEMES: { value: ThemePref; label: string; hint: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', hint: 'Follow this device', icon: Monitor },
  { value: 'light', label: 'Light', hint: 'Cream paper', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Candle-lit brown', icon: Moon },
]

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'about' ? 'about' : 'appearance'

  return (
    <div className={ui.page}>
      <PageHeader title="Settings" description="Preferences for this browser, and what this server is running." />
      <Tabs
        label="Settings sections"
        value={tab}
        onChange={(v) => setParams(v === 'appearance' ? {} : { tab: v }, { replace: true })}
        items={[
          { value: 'appearance', label: 'Appearance' },
          { value: 'about', label: 'About' },
        ]}
      >
        {tab === 'appearance' ? <Appearance /> : <About />}
      </Tabs>
    </div>
  )
}

function Appearance() {
  const { pref, theme, setPref } = useTheme()
  return (
    <Card title="Theme">
      <p className={ui.sectionNote}>Saved in this browser (key <code className="code-chip">ote:theme</code>, shared by every app on this site that uses it).</p>
      <fieldset className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-3">
        <legend className="sr-only">Theme</legend>
        {THEMES.map((t) => (
          <label key={t.value} className="choice">
            <input type="radio" name="theme" value={t.value} checked={pref === t.value} onChange={() => setPref(t.value)} />
            <Icon icon={t.icon} />
            <span className="flex flex-col">
              <span className="font-semibold">{t.label}</span>
              <span className="text-xs opacity-80">{t.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted">
        Showing <strong className="text-ink">{theme}</strong> now{pref === 'system' ? ' (from your device setting)' : ''}.
      </p>
    </Card>
  )
}

function About() {
  const health = useLoad((signal) => getHealth(signal))
  const h = health.data
  const { name } = getAppConfig().app
  const row = (label: string, value: ReactNode) => (
    <>
      <dt className={ui.dt}>{label}</dt>
      <dd className={ui.dd}>{value}</dd>
    </>
  )
  return (
    <Card title="About this server">
      {health.error ? <Callout tone="danger">{errorMessage(health.error)}</Callout> : null}
      {!h && !health.error ? (
        <div className="flex flex-col gap-2">
          <Skeleton width="40%" />
          <Skeleton width="60%" />
          <Skeleton width="30%" />
        </div>
      ) : h ? (
        <dl className={ui.dl}>
          {row('App', name)}
          {row('Service', <span className="mono">{h.service}</span>)}
          {row(
            'Version',
            <span className="inline-flex items-center gap-2">
              <span className="mono">{h.version}</span>
              <CopyButton text={`${h.service} ${h.version}`} iconOnly label="Copy version" />
            </span>,
          )}
          {row('Database', <Chip tone={h.db === 'up' ? 'ok' : h.db === 'down' ? 'danger' : 'neutral'} dot>{h.db === 'off' ? 'Off (database.enabled = false)' : h.db === 'up' ? 'Up' : 'Down'}</Chip>)}
          {row('Uptime', fmtUptime(h.uptime_s))}
          {row('Server time', <time dateTime={h.time}>{fmtDateTime(h.time)}</time>)}
        </dl>
      ) : null}
    </Card>
  )
}
