import { api, dateTime, useApi } from '@trueglaz/core'
import { ErrorNote, Loading } from '../../components/ui'
import { fromPaise, SettingRow, unitWord } from './SettingRow'

const COPY: Record<string, { title: string; lede: string }> = {
  selling: {
    title: 'Selling & checkout',
    lede: 'How long things are held and how long people have to act. Changes apply from the next time each one is read: a buyer already inside a return window keeps the one they were given.',
  },
  payouts: {
    title: 'Payouts',
    lede: 'Approving a payout is always an admin’s job. Below this amount, staff may also send one that is already approved.',
  },
  security: {
    title: 'Sign-in & security',
    lede: 'Sign-in codes and sessions. Loosening these makes accounts easier to break into; tightening them makes sign-in harder for real people on shared networks.',
  },
}

/** One group of settings, each editable in place, with its recent changes underneath. */
export function SettingsGroupPage({ group }: { group: 'selling' | 'payouts' | 'security' }) {
  const rows = useApi(() => api.adminSettings(), [])
  const changes = useApi(() => api.settingHistory(), [])
  const mine = (rows.data ?? []).filter((s) => s.groupCode === group)
  const byKey = new Map(mine.map((s) => [s.key, s]))
  const recent = (changes.data ?? []).filter((c) => byKey.has(c.key)).slice(0, 8)
  const copy = COPY[group]

  return (
    <section>
      <h2 className="st__h">{copy.title}</h2>
      <p className="st__lede">{copy.lede}</p>
      {rows.loading && !rows.data && <Loading label="Loading settings" />}
      {rows.error && <ErrorNote error={rows.error} onRetry={rows.reload} />}
      <div className="st__card">
        {mine.map((s) => <SettingRow key={s.key + s.value} s={s} onSaved={() => { rows.reload(); changes.reload() }} />)}
      </div>
      {recent.length > 0 && (
        <>
          <h3 className="st__kicker">Recent changes</h3>
          <ul className="st__changes">
            {recent.map((c, i) => {
              const s = byKey.get(c.key)!
              const v = (x: string | null) => x == null ? '—' : s.unit === 'rupees' ? `₹${fromPaise(x)}` : `${x} ${unitWord(s.unit)}`
              return <li key={i}><strong>{s.label}</strong>: {v(c.oldValue)} → {v(c.newValue)} <span className="st__muted">· {c.changedAt && dateTime(c.changedAt)}</span></li>
            })}
          </ul>
        </>
      )}
    </section>
  )
}
