import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, dateTime, useApi, type PlatformSetting } from '@trueglaz/core'
import { ErrorNote, Loading } from '../../components/ui'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { readable, SettingRow, shownValue, storedValue } from './SettingRow'
import { SectionHead } from './SettingsLayout'
import { Icon, ICONS } from '../../components/StaffShell'

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
  notifications: {
    title: 'Notifications',
    lede: 'Sellers and buyers always see events in the app. Switch on email or WhatsApp to send the same updates over those channels too, and set the sender they come from. The sending credentials themselves (the verified email identity, the WhatsApp provider) are configured on the server.',
  },
}

/** One group of settings, with its recent changes underneath. */
export function SettingsGroupPage({ group }: { group: 'selling' | 'payouts' | 'security' | 'notifications' }) {
  const rows = useApi(() => api.adminSettings(), [])
  const changes = useApi(() => api.settingHistory(), [])
  const mine = useMemo(() => (rows.data ?? []).filter((s) => s.groupCode === group), [rows.data, group])
  const byKey = new Map(mine.map((s) => [s.key, s]))
  const recent = (changes.data ?? []).filter((c) => byKey.has(c.key)).slice(0, 8)
  const copy = COPY[group]

  const lastAt = mine.map((x) => x.updatedAt).filter(Boolean).sort().pop()
  return (
    <section className="st__page">
      <SectionHead page={group} aside={<span className="c-chip2 c-chip2--navy">{mine.length} setting{mine.length === 1 ? '' : 's'}</span>}>
        {copy.lede}
      </SectionHead>
      {rows.loading && !rows.data && <Loading label="Loading settings" />}
      {rows.error && <ErrorNote error={rows.error} onRetry={rows.reload} />}
      <div className="st__cols">
        <StagedSettings settings={mine} onSaved={() => { rows.reload(); changes.reload() }} />
        <aside className="st__card st__rail" aria-label="Recent changes">
          <div className="st__card-head"><h3>Recent changes</h3>{lastAt && <span className="st__muted">{dateTime(lastAt)}</span>}</div>
          {recent.length === 0 ? <p className="st__muted">Nothing changed here yet.</p> : (
            <ol className="st__tl">
              {recent.map((c, i) => {
                const s = byKey.get(c.key)!
                return (
                  <li key={i}>
                    <span className="st__tl-dot"><Icon d={ICONS.history} /></span>
                    <div>
                      <b>{s.label}</b>
                      <div className="st__tl-diff"><span className="st__diff-was">{readable(s, c.oldValue)}</span> → <span className="st__diff-now">{readable(s, c.newValue)}</span></div>
                      <small className="st__muted">{c.changedAt && dateTime(c.changedAt)}{c.changedBy && !/^[0-9a-f-]{36}$/i.test(c.changedBy) ? ` · ${c.changedBy}` : ''}</small>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </aside>
      </div>
    </section>
  )
}

/**
 * A card of settings whose changes are staged, not saved field by field (TG-204).
 *
 * One bar at the bottom counts them; "Review and save" shows each one as
 * before → after, saves them together and leaves any the server refused on
 * its row with the reason. Leaving the page with changes staged asks first.
 */
export function StagedSettings({ settings: mine, onSaved, bare = false }: { settings: PlatformSetting[]; onSaved: () => void; bare?: boolean }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const nav = useNavigate()

  const valueOf = (s: PlatformSetting) => drafts[s.key] ?? shownValue(s)
  const pending = mine.filter((s) => drafts[s.key] != null && drafts[s.key].trim() !== shownValue(s).trim())
  const dirty = pending.length > 0

  function stage(s: PlatformSetting, v: string) {
    setNotice(null)
    setDrafts((d) => ({ ...d, [s.key]: v }))
    setErrors((e) => { const { [s.key]: _, ...rest } = e; return rest })
  }
  function discard() { setDrafts({}); setErrors({}); setNotice(null) }

  async function saveAll() {
    setBusy(true)
    const failed: Record<string, string> = {}
    let ok = 0
    for (const s of pending) {
      const v = storedValue(s, drafts[s.key])
      if (v == null) { failed[s.key] = 'Enter an amount in rupees, like 400 or 399.50'; continue }
      try { await api.setSetting(s.key, v); ok++ }
      catch (e) {
        const m = e instanceof ApiError || e instanceof Error ? e.message : 'That did not work'
        // The server names the setting by its key; on its own row that is just "This".
        failed[s.key] = m.startsWith(s.key) ? `This ${m.slice(s.key.length).trim()}.`.replace(/\.\.$/, '.') : m
      }
    }
    // Saved ones leave the bar; refused ones stay staged, with the reason on their row.
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k in failed)))
    setErrors(failed)
    setBusy(false); setReview(false)
    const bad = Object.keys(failed).length
    setNotice(bad === 0 ? `Saved ${ok} change${ok === 1 ? '' : 's'}.` : `Saved ${ok}; ${bad} need${bad === 1 ? 's' : ''} fixing — see the highlighted row${bad === 1 ? '' : 's'}.`)
    onSaved()
  }

  // Leaving with changes staged: the browser asks on reload or close; a link
  // inside the console asks with our own dialog.
  useEffect(() => {
    if (!dirty) return
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.origin !== window.location.origin) return
      if (a.pathname === window.location.pathname) return
      e.preventDefault(); e.stopPropagation()
      setLeaveTo(a.pathname + a.search + a.hash)
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true) }
  }, [dirty])

  return (
    <div className={dirty ? 'st__staged' : undefined}>
      {notice && !dirty && <p className="st__ok st__notice" role="status">{notice}</p>}
      <div className={bare ? undefined : 'st__card'}>
        {mine.map((s) => <SettingRow key={s.key} s={s} value={valueOf(s)} onChange={(v) => stage(s, v)} error={errors[s.key]} />)}
      </div>

      {dirty && (
        <div className="st__bar" role="region" aria-label="Unsaved changes">
          <span className="st__bar-text"><b>{pending.length}</b> change{pending.length === 1 ? '' : 's'} not saved{notice ? <span className="st__bar-note"> · {notice}</span> : null}</span>
          <button type="button" className="c-btn c-btn--sm" onClick={discard}>Discard</button>
          <button type="button" className="c-btn c-btn--cta c-btn--sm" onClick={() => setReview(true)}>Review and save ({pending.length})</button>
        </div>
      )}

      <ConfirmDialog open={review} title={`Save ${pending.length} change${pending.length === 1 ? '' : 's'}?`}
        confirmLabel={busy ? 'Saving…' : 'Save changes'} busy={busy} cancelLabel="Keep editing"
        onConfirm={() => void saveAll()} onCancel={() => setReview(false)}>
        <p className="st__muted">They apply from the next time each one is read. Every change is recorded with your name.</p>
        <ul className="st__diff">
          {pending.map((s) => (
            <li key={s.key}>
              <span className="st__diff-label">{s.label ?? s.key}</span>
              <span className="st__diff-was">{readable(s, s.value)}</span>
              <span aria-hidden="true">→</span><span className="tg-visually-hidden">becomes</span>
              <span className="st__diff-now">{readable(s, storedValue(s, drafts[s.key]) ?? drafts[s.key])}</span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog open={leaveTo != null} title="Leave without saving?" destructive
        confirmLabel={`Discard ${pending.length} change${pending.length === 1 ? '' : 's'}`} cancelLabel="Stay here"
        onConfirm={() => { const to = leaveTo!; discard(); setLeaveTo(null); setTimeout(() => nav(to), 0) }}
        onCancel={() => setLeaveTo(null)}>
        <p>You have {pending.length} change{pending.length === 1 ? '' : 's'} on this page that {pending.length === 1 ? 'is' : 'are'} not saved.</p>
      </ConfirmDialog>
    </div>
  )
}
