import { Callout } from '../../components/ui/Card'

// Shown instead of an error when the backend runs without a database (the template's default).
export function DbDisabledCallout() {
  return (
    <Callout tone="info" title="The demo needs a database">
      Template items live in the <code className="code-chip">mst_template_items</code> table. Set{' '}
      <code className="code-chip">database.enabled</code> to <code className="code-chip">true</code> in{' '}
      <code className="code-chip">Backend/config.json</code>, run <code className="code-chip">npm run db:migrate</code>, and restart the server.
    </Callout>
  )
}
