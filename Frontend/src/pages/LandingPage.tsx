import { Link } from 'react-router-dom'
import { Database, LayoutDashboard, LogIn, Radio, ShieldCheck, Zap } from 'lucide-react'
import { getAppConfig } from '../config'
import { Icon, type IconComponent } from '../components/ui/Icon'
import { buttonClass } from '../components/ui/variants'
import { ui } from '../ui'

// The public page at "/" — a placeholder for the project's own front door. Replace the copy;
// keep the shape (one headline, one sentence, one primary action into the console).

const FEATURES: { icon: IconComponent; title: string; body: string }[] = [
  { icon: Zap, title: 'One origin', body: 'Fastify serves this React build and the API from the same port — no CORS to configure.' },
  { icon: Database, title: 'Database optional', body: 'None, Postgres, other SQL or a local SQLite file. ฐานข้อมูลเลือกได้' },
  { icon: ShieldCheck, title: 'Sign in your way', body: 'Root account, local users or Login with Oteracount — each an optional module.' },
  { icon: Radio, title: 'Live updates', body: 'WebSocket and SSE modules, off until you need them.' },
]

export default function LandingPage() {
  const { name, subtitle } = getAppConfig().app
  return (
    <div className="public-container flex flex-col gap-12 pt-10 pb-16 sm:pt-16">
      <section className="flex max-w-[760px] flex-col gap-4">
        <span className="kicker">{name}</span>
        <h1 className="text-[clamp(30px,5vw,44px)] leading-[1.12]">A public page for visitors, a console for the people who run it.</h1>
        <p className="max-w-[62ch] text-base text-muted sm:text-[16px]">{subtitle}</p>
        <p className="max-w-[62ch] text-sm text-muted">
          หน้าสาธารณะอยู่ที่ <code className="code-chip">/</code> และหน้าจัดการอยู่ที่ <code className="code-chip">/console</code>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link to="/console" className={buttonClass('primary')}>
            <Icon icon={LayoutDashboard} />
            Go to console
          </Link>
          <Link to="/login" className={buttonClass()}>
            <Icon icon={LogIn} />
            Sign in
          </Link>
        </div>
      </section>

      <section aria-label="Features" className={ui.cards}>
        {FEATURES.map((f) => (
          <div key={f.title} className="card card-pad flex flex-col gap-1.5">
            <h2 className="flex items-center gap-2 text-[15px]">
              <span className="text-accent">
                <Icon icon={f.icon} />
              </span>
              {f.title}
            </h2>
            <p className="text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
