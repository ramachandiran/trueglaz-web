import { useState } from 'react'
import { api, ApiError, useApi, type NotificationSettings } from '@trueglaz/core'
import { ErrorNote, Loading } from './ui'
import './NotificationChoices.css'

/**
 * What a person hears about, and where. Email, WhatsApp and push (the phone app)
 * each switch on or off per kind of message; the in-app list always keeps
 * everything, and security alerts cannot be turned off.
 */
export function NotificationChoices() {
  const settings = useApi(() => api.notificationSettings(), [])
  const [view, setView] = useState<NotificationSettings | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const s = view ?? settings.data

  async function toggle(category: string, channel: string, enabled: boolean) {
    setErr(null)
    try { setView(await api.updateNotificationSettings([{ category, channel, enabled }])) }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not save that') }
  }

  return (
    <section className="tg-card profile__section" id="notification-choices">
      <h2 className="profile__section-title">Notification settings</h2>
      {settings.loading && !s && <Loading />}
      {settings.error && <ErrorNote error={settings.error} onRetry={settings.reload} />}
      {s && s.channels.length === 0 && (
        <p className="tg-muted profile__blurb">Every update shows in Notifications above. Email, WhatsApp and push aren't switched on yet.</p>
      )}
      {s && s.channels.length > 0 && (
        <>
          <p className="tg-muted profile__blurb">
            Everything always shows in Notifications above. Push goes to the TrueGlaz phone app wherever you're signed in.
          </p>
          <table className="nchoice">
            <thead>
              <tr><th scope="col">Kind of message</th>{s.channels.map((c) => <th key={c.code} scope="col">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {s.categories.map((cat) => (
                <tr key={cat.code}>
                  <th scope="row"><b>{cat.label}</b><small>{cat.hint}</small></th>
                  {s.channels.map((ch) => (
                    <td key={ch.code}>
                      <input type="checkbox" className="nchoice__box" checked={s.enabled[cat.code]?.[ch.code] !== false}
                        disabled={cat.locked} aria-label={`${cat.label} by ${ch.label}`}
                        onChange={(e) => toggle(cat.code, ch.code, e.target.checked)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {err && <p className="ops__error" role="alert">{err}</p>}
        </>
      )}
    </section>
  )
}
