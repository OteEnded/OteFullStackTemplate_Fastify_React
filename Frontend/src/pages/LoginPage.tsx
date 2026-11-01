import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api'
import { AuthLayout } from '../components/shell/AuthLayout'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Icon } from '../components/ui/Icon'

// Sign-in card. Wired to useAuth() — a STUB until Slice 8, so a submit explains that sign-in
// isn't enabled yet, and the console stays reachable without signing in.
export default function LoginPage() {
  const { signIn, enabled } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<{ username?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const m = { username: username.trim() ? undefined : 'Enter your username.', password: password ? undefined : 'Enter your password.' }
    setMissing(m)
    if (m.username || m.password) return
    setBusy(true)
    setError('')
    try {
      await signIn(username.trim(), password)
      navigate('/console', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      blurb="Use your account to open the console."
      footer={
        !enabled && (
          <Link to="/console" className="inline-flex items-center gap-1.5 text-accent-deep hover:underline">
            Continue to the console without signing in
            <Icon icon={ArrowRight} size={14} />
          </Link>
        )
      }
    >
      {error && (
        <Callout tone={enabled ? 'danger' : 'info'} title={enabled ? 'Couldn’t sign you in' : undefined}>
          {error}
        </Callout>
      )}
      <form className="flex flex-col gap-3.5" onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Username" error={missing.username}>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="off" spellCheck={false} autoFocus />
        </Field>
        <Field label="Password" error={missing.password}>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <Button type="submit" variant="primary" icon={LogIn} loading={busy} className="btn-block mt-1">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
