import { useState } from 'react'
import { api, ApiError, dateOnly, relative, useApi, useSession } from '@trueglaz/core'
import { ErrorNote, Loading } from '../../components/ui'
import { ConfirmDialog } from '../../components/ConfirmDialog'

const ROLES = [
  { code: 'staff', label: 'Staff', blurb: 'Operations, fulfilment, returns, people and the insurance desk' },
  { code: 'technician', label: 'Technician', blurb: 'Inspection and the bench check on returns' },
  { code: 'admin', label: 'Admin', blurb: 'Everything, including money, settings and this page' },
]
const label = (r: string) => ROLES.find((x) => x.code === r)?.label ?? r

/**
 * Who works here (TG-85).
 *
 * An admin adds staff, technicians and other admins by email. Someone who has
 * already signed in gets the role at once; anyone else gets an invite that
 * applies the first time they sign in with that email. Taking a role away works
 * at their next click. Every change is in the audit log.
 */
export function TeamSettingsPage() {
  const { session } = useSession()
  const team = useApi(() => api.team(), [])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [revoke, setRevoke] = useState<{ userId: string; name: string; role: string } | null>(null)

  if (team.loading && !team.data) return <Loading label="Loading the team" />
  if (team.error) return <ErrorNote error={team.error} onRetry={team.reload} />
  const t = team.data!

  async function add() {
    setBusy(true); setError(null); setNotice(null)
    try {
      const r = await api.grantRole(email.trim(), role)
      setNotice(r.outcome === 'granted'
        ? `${r.member?.displayName ?? email} is now ${label(role).toLowerCase()}. It works from their next click.`
        : `Invite saved. ${email} becomes ${label(role).toLowerCase()} the first time they sign in with that email.`)
      setEmail(''); team.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(false) }
  }

  async function doRevoke() {
    if (!revoke) return
    setBusy(true); setError(null); setNotice(null)
    try {
      await api.revokeRole(revoke.userId, revoke.role)
      setNotice(`${revoke.name} is no longer ${label(revoke.role).toLowerCase()}.`)
      setRevoke(null); team.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work'); setRevoke(null)
    } finally { setBusy(false) }
  }

  async function cancel(id: string) {
    setBusy(true); setError(null)
    try { await api.cancelInvite(id); team.reload() } catch (e) { setError(e instanceof ApiError ? e.message : 'That did not work') } finally { setBusy(false) }
  }

  return (
    <div>
      <h2 className="st__h">Team</h2>
      <p className="st__lede">
        Who can use this console, and what they can do. Add someone by the email they sign in with. If they have
        not signed in yet, they get the role the first time they do. Every change is recorded in the audit log.
      </p>

      <section className="st__card team__add">
        <h3 className="st__card-title">Add someone</h3>
        <div className="team__form">
          <label className="team__field team__field--email">
            <span>Email</span>
            <input className="tg-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>
          <label className="team__field">
            <span>Role</span>
            <select className="tg-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          </label>
          <button className="tg-button tg-button--primary" disabled={busy || !email.includes('@')} onClick={add}>
            {busy ? 'Adding…' : 'Add to team'}
          </button>
        </div>
        <p className="st__muted">{ROLES.find((r) => r.code === role)?.blurb}</p>
        {notice && <p className="team__ok" role="status">{notice}</p>}
        {error && <p className="st__error" role="alert">{error}</p>}
      </section>

      <p className="st__kicker">Members ({t.members.length})</p>
      <div className="st__card team__list">
        <table className="team__table">
          <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Last active</th></tr></thead>
          <tbody>
            {t.members.map((m) => (
              <tr key={m.userId}>
                <td><strong>{m.displayName}</strong>{m.userId === session?.userId && <span className="st__muted"> (you)</span>}</td>
                <td className="st__muted">{m.email ?? '—'}</td>
                <td>
                  <div className="team__roles">
                    {m.roles.map((r) => (
                      <span key={r.role} className={`team__role team__role--${r.role}`} title={`Since ${dateOnly(r.grantedAt)}${r.grantedByName ? `, by ${r.grantedByName}` : ''}`}>
                        {label(r.role)}
                        {!(m.userId === session?.userId && r.role === 'admin') && (
                          <button type="button" className="team__x" aria-label={`Remove ${label(r.role)} from ${m.displayName}`}
                            onClick={() => setRevoke({ userId: m.userId, name: m.displayName, role: r.role })}>×</button>
                        )}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="st__muted">{m.lastSeenAt ? relative(m.lastSeenAt) : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {t.invites.length > 0 && (
        <>
          <p className="st__kicker">Waiting for first sign-in ({t.invites.length})</p>
          <div className="st__card team__list">
            <table className="team__table">
              <thead><tr><th>Email</th><th>Role</th><th>Invited</th><th /></tr></thead>
              <tbody>
                {t.invites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td>{label(i.role)}</td>
                    <td className="st__muted">{dateOnly(i.createdAt)}{i.invitedByName ? ` by ${i.invitedByName}` : ''}</td>
                    <td style={{ textAlign: 'right' }}><button className="tg-button tg-button--subtle" disabled={busy} onClick={() => cancel(i.id)}>Cancel invite</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!revoke} title={`Remove ${revoke ? label(revoke.role).toLowerCase() : ''} from ${revoke?.name ?? ''}?`}
        confirmLabel="Remove role" busy={busy} onConfirm={doRevoke} onCancel={() => setRevoke(null)}
      >
        <p>They lose access to those screens from their next click. Anything they did stays in the record.</p>
      </ConfirmDialog>
    </div>
  )
}
