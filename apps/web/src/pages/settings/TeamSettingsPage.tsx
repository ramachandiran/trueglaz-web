import { useState } from 'react'
import { api, ApiError, dateOnly, relative, useApi, useSession, type TeamInvite } from '@trueglaz/core'
import { ErrorNote, Loading } from '../../components/ui'
import { ConfirmDialog } from '../../components/ConfirmDialog'

const ROLES = [
  { code: 'staff', label: 'Staff', blurb: 'Operations, fulfilment, returns, people and the insurance desk' },
  { code: 'technician', label: 'Technician', blurb: 'Inspection on the bench and the check on returned units' },
  { code: 'admin', label: 'Admin', blurb: 'Everything, including money, settings and this page' },
]
const label = (r: string) => ROLES.find((x) => x.code === r)?.label ?? r
const ROLE_PILL: Record<string, string> = { admin: 'c-pill--cta', staff: 'c-pill--navy', technician: 'c-pill--good' }

/**
 * Who works here (TG-85, TG-133).
 *
 * An admin invites staff, technicians and other admins by email. Somebody who
 * already has an account gets the role at once and a notice that they have it.
 * Anyone else gets an email with a sign-in link that works for a week; the
 * first sign-in with that address turns it into the role. Invites can be sent
 * again, copied to share another way, or cancelled. Every change is audited.
 */
export function TeamSettingsPage() {
  const { session } = useSession()
  const team = useApi(() => api.team(), [])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [revoke, setRevoke] = useState<{ userId: string; name: string; role: string } | null>(null)
  const [cancelling, setCancelling] = useState<TeamInvite | null>(null)

  if (team.loading && !team.data) return <Loading label="Loading the team" />
  if (team.error) return <ErrorNote error={team.error} onRetry={team.reload} />
  const t = team.data!
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())

  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key); setError(null); setNotice(null)
    try { const m = await fn(); if (m) setNotice(m); team.reload() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'That did not work') }
    finally { setBusy(null) }
  }

  const invite = () => run('add', async () => {
    const r = await api.grantRole(email.trim(), role)
    setEmail('')
    if (r.outcome === 'granted') return `${r.member?.displayName ?? email} already had an account and is now ${label(role)}. We have let them know.`
    if (r.outcome === 'resent') return `${email} already had an invite for ${label(role)}. We sent it again, good for another 7 days.`
    return `Invite sent to ${email}. It works for 7 days; they become ${label(role)} the first time they sign in with that address.`
  })

  const copy = async (i: TeamInvite) => {
    if (!i.link) return
    const url = window.location.origin + i.link
    try { await navigator.clipboard.writeText(url); setNotice(`Link for ${i.email} copied. Share it only with them: it signs them up as ${label(i.role)}.`) }
    catch { window.prompt('Copy this invite link', url) }
  }

  return (
    <div className="team">
      <h2 className="st__h">Team</h2>
      <p className="st__lede">
        Who can use this console and what they can do. Invite people by the email they will sign in with. Every change is
        recorded in the audit log.
      </p>

      <section className="c-card team__invite" aria-labelledby="team-invite">
        <div className="c-card__head"><h2 id="team-invite">Invite someone</h2></div>
        <div className="team__roles-pick" role="radiogroup" aria-label="Role">
          {ROLES.map((r) => (
            <label key={r.code} className={`team__role-card${role === r.code ? ' team__role-card--on' : ''}`}>
              <input type="radio" name="role" value={r.code} checked={role === r.code} onChange={() => setRole(r.code)} />
              <b>{r.label}</b>
              <span>{r.blurb}</span>
            </label>
          ))}
        </div>
        <form className="team__form" onSubmit={(e) => { e.preventDefault(); if (valid) invite() }}>
          <label className="team__field team__field--email">
            <span>Their email</span>
            <input className="tg-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" autoComplete="off" />
          </label>
          <button className="tg-button tg-button--primary" disabled={busy === 'add' || !valid}>
            {busy === 'add' ? 'Sending…' : `Send invite as ${label(role)}`}
          </button>
        </form>
        <p className="st__muted">
          They get an email with a sign-in link that works for 7 days. Already have an account with that email? They get the role at
          once and a notice.
        </p>
        {notice && <p className="team__ok" role="status">{notice}</p>}
        {error && <p className="st__error" role="alert">{error}</p>}
      </section>

      {t.invites.length > 0 && (
        <section className="c-card" aria-labelledby="team-pending">
          <div className="c-card__head"><h2 id="team-pending">Invited, not signed in yet</h2><span className="c-card__note">{t.invites.length}</span></div>
          <div className="c-table-wrap">
            <table className="c-table">
              <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Invited</th><th /></tr></thead>
              <tbody>
                {t.invites.map((i) => (
                  <tr key={i.id}>
                    <td><b>{i.email}</b></td>
                    <td><span className={`c-pill ${ROLE_PILL[i.role] ?? ''}`}>{label(i.role)}</span></td>
                    <td>
                      {i.expired
                        ? <span className="c-pill c-pill--bad">Expired</span>
                        : <span className="c-pill c-pill--good">Works until {dateOnly(i.expiresAt ?? null)}</span>}
                      <span className="team__sent">{i.lastSentAt ? `Emailed ${relative(i.lastSentAt)}${(i.sendCount ?? 0) > 1 ? ` · ${i.sendCount} times` : ''}` : 'Not emailed yet'}</span>
                    </td>
                    <td className="tg-muted">{dateOnly(i.createdAt)}{i.invitedByName ? ` by ${i.invitedByName}` : ''}</td>
                    <td>
                      <div className="team__acts">
                        <button type="button" className="tg-button" disabled={busy === i.id} onClick={() => run(i.id, async () => { await api.resendInvite(i.id); return `Sent again to ${i.email}, good for another 7 days.` })}>
                          {i.expired ? 'Renew and resend' : 'Resend'}
                        </button>
                        <button type="button" className="tg-button tg-button--subtle" disabled={i.expired} onClick={() => copy(i)}>Copy link</button>
                        <button type="button" className="tg-button tg-button--subtle" onClick={() => setCancelling(i)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="c-card" aria-labelledby="team-members">
        <div className="c-card__head"><h2 id="team-members">Members</h2><span className="c-card__note">{t.members.length}</span></div>
        <div className="c-table-wrap">
          <table className="c-table">
            <thead><tr><th>Person</th><th>Roles</th><th>Last active</th></tr></thead>
            <tbody>
              {t.members.map((m, n) => (
                <tr key={m.userId}>
                  <td>
                    <span className="c-who">
                      <span className={`c-av c-av--${n % 4}`}>{initials(m.displayName)}</span>
                      <span><b>{m.displayName}{m.userId === session?.userId && <span className="tg-muted"> (you)</span>}</b><span>{m.email ?? '—'}</span></span>
                    </span>
                  </td>
                  <td>
                    <div className="team__roles">
                      {m.roles.map((r) => (
                        <span key={r.role} className={`c-pill ${ROLE_PILL[r.role] ?? ''} team__role`} title={`Since ${dateOnly(r.grantedAt)}${r.grantedByName ? `, by ${r.grantedByName}` : ''}`}>
                          {label(r.role)}
                          {!(m.userId === session?.userId && r.role === 'admin') && (
                            <button type="button" className="team__x" aria-label={`Remove ${label(r.role)} from ${m.displayName}`}
                              onClick={() => setRevoke({ userId: m.userId, name: m.displayName, role: r.role })}>×</button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="tg-muted">{m.lastSeenAt ? relative(m.lastSeenAt) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={!!revoke} title={`Remove ${revoke ? label(revoke.role).toLowerCase() : ''} from ${revoke?.name ?? ''}?`}
        confirmLabel="Remove role" busy={busy === 'revoke'}
        onConfirm={() => run('revoke', async () => { const r = revoke!; await api.revokeRole(r.userId, r.role); setRevoke(null); return `${r.name} is no longer ${label(r.role).toLowerCase()}.` })}
        onCancel={() => setRevoke(null)}
      >
        <p>They lose access to those screens from their next click. Anything they did stays in the record.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!cancelling} title={`Cancel the invite for ${cancelling?.email ?? ''}?`}
        confirmLabel="Cancel invite" busy={busy === 'cancel'}
        onConfirm={() => run('cancel', async () => { const i = cancelling!; await api.cancelInvite(i.id); setCancelling(null); return `The invite for ${i.email} no longer works.` })}
        onCancel={() => setCancelling(null)}
      >
        <p>The link in their email stops working. You can invite them again later.</p>
      </ConfirmDialog>
    </div>
  )
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}
