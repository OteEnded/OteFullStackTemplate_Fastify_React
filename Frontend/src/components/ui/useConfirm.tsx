import { useCallback, useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { Input } from './Field'

// Promise-based confirm — NEVER window.confirm() (Ote has banned it twice).
//   const [confirmEl, confirm] = useConfirm()
//   if (await confirm({ title: 'Archive “X”?', tone: 'warn', confirmLabel: 'Archive' })) …
//   return <>{confirmEl}…</>
// Shape: Oteracount useConfirm (promise) + OSM ConfirmModal (question / consequences) +
// EAP typeToConfirm (for the irreversible ones).

export type ConfirmOptions = {
  title: string
  /** One sentence: what will happen. */
  question?: ReactNode
  /** Bullet list of side effects people should know before saying yes. */
  consequences?: ReactNode[]
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'warn' | 'danger'
  /** Require typing this exact text before the confirm button enables. */
  typeToConfirm?: string
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [pending, setPending] = useState<Pending | null>(null)
  const [typed, setTyped] = useState('')

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped('')
        setPending({ ...options, resolve })
      }),
    [],
  )

  const finish = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  const blocked = Boolean(pending?.typeToConfirm) && typed !== pending?.typeToConfirm

  const element = pending && (
    <Dialog
      title={pending.title}
      size="sm"
      onClose={() => finish(false)}
      onSubmit={() => {
        if (!blocked) finish(true)
      }}
      footer={
        <>
          <Button onClick={() => finish(false)} data-autofocus={pending.typeToConfirm ? undefined : true}>
            {pending.cancelLabel ?? 'Cancel'}
          </Button>
          <Button type="submit" variant={pending.tone ?? 'primary'} disabled={blocked} data-ui="confirm-yes">
            {pending.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      {pending.question && <div className="text-sm text-muted">{pending.question}</div>}
      {pending.consequences && pending.consequences.length > 0 && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
          {pending.consequences.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
      {pending.typeToConfirm && (
        <label className="field">
          <span className="field-hint">
            Type <strong className="code-chip">{pending.typeToConfirm}</strong> to confirm
          </span>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} data-autofocus autoComplete="off" spellCheck={false} />
        </label>
      )}
    </Dialog>
  )

  return [element, confirm]
}
