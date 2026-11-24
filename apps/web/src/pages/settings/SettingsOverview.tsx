import { Link } from 'react-router-dom'
import { api, dateTime, useApi, type PlatformSetting } from '@trueglaz/core'
import { Icon, ICONS } from '../../components/StaffShell'
import { fromPaise, unitWord } from './SettingRow'
import { SectionHead, SETTINGS_PAGES, useSettingsAttention, type SettingsPageKey } from './SettingsLayout'

/**
 * The settings at a glance (TG-206): what needs attention first, then one card
 * per page with its headline values, each card a way in.
 */
export function SettingsOverview() {
  const settings = useApi(() => api.adminSettings(), [])
  const fees = useApi(() => api.adminFees(), [])
  const company = useApi(() => api.adminCompany(), [])
  const meta = useApi(() => api.meta(), [])
  const models = useApi(() => api.adminModels({}), [])
  const changes = useApi(() => api.settingHistory(), [])
  const attention = useSettingsAttention()

  const s = new Map((settings.data ?? []).map((x) => [x.key, x]))
  const v = (k: string) => show(s.get(k))
  const gateway = meta.data?.paymentGateway === 'razorpay' ? 'Razorpay' : 'Demo gateway'
  const flags = Object.entries(attention) as [SettingsPageKey, string][]
  const last = changes.data?.[0]

  const cards: Record<string, [string, string][]> = {
    selling: [['Return window', v('return_window_hours')], ['Checkout hold', v('reservation_timeout_minutes')], ['Seller answers a price within', v('seller_approval_days')]],
    fees: [['Commission', (fees.data?.commissionBands ?? []).map((b) => `${b.percent}%`).join(' / ') || '—'], ['GST on commission', v('commission_gst_percent')], ['Delivery charge', v('shipping_flat_minor')]],
    payouts: [['Staff may send up to', v('payout_auto_release_max_minor')], ['Payment gateway', meta.data ? `${gateway}${meta.data.paymentsAreReal ? ' · live' : ' · test'}` : '—']],
    company: [['Legal name', company.data?.profile.legalName || '—'], ['GSTIN', company.data?.profile.gstin || '—']],
    catalogue: [['Models', models.data ? String(models.data.counts.total) : '—']],
    models: [['With a photograph', models.data ? `${models.data.counts.photo} of ${models.data.counts.total}` : '—']],
    security: [['Sign-in code valid for', v('otp_ttl_seconds')], ['Stay signed in for', v('session_ttl_days')]],
    notifications: [['Email updates', onOff(s.get('notify_email_enabled'))], ['WhatsApp updates', onOff(s.get('notify_whatsapp_enabled'))]],
  }

  return (
    <section className="st__page">
      <SectionHead page="" aside={last?.changedAt && <span className="st__stamp"><Icon d={ICONS.history} /> Last change {dateTime(last.changedAt)}</span>}>
        How the platform behaves, by topic. Changes apply without a deploy and every one is recorded with who made it. Start with anything flagged below.
      </SectionHead>

      {flags.length > 0 && (
        <div className="st__card st__attn" role="region" aria-label="Needs attention">
          <div className="st__card-head"><h3>Needs attention</h3><span className="c-chip2 c-chip2--warn">{flags.length}</span></div>
          <ul className="st__attn-list">
            {flags.map(([to, text]) => {
              const p = SETTINGS_PAGES.find((x) => x.to === to)!
              return (
                <li key={to}>
                  <span className="st__attn-ic"><Icon d={ICONS.alert} /></span>
                  <span className="st__attn-text"><b>{p.label}</b><small>{text}</small></span>
                  <Link className="c-btn c-btn--sm" to={`/admin/settings/${to}`}>Review</Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="st__grid">
        {SETTINGS_PAGES.filter((p) => p.to !== '').map((p) => (
          <Link key={p.to} to={`/admin/settings/${p.to}`} className="st__tile">
            <span className="st__tile-top">
              <span className="st__tile-ic"><Icon d={p.icon} /></span>
              <span className="st__tile-title"><b>{p.label}</b><small>{p.blurb}</small></span>
              {attention[p.to] && <span className="st__dot" aria-hidden="true" />}
            </span>
            <dl>
              {(cards[p.to] ?? []).map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
            </dl>
            <span className="st__tile-go">Open <Icon d={ICONS.arrow} /></span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function onOff(s?: PlatformSetting) { return !s ? '—' : s.value === 'true' ? 'On' : 'Off' }

function show(s?: PlatformSetting): string {
  if (!s) return '—'
  if (s.unit === 'rupees') return `₹${Number(fromPaise(s.value)).toLocaleString('en-IN')}`
  return `${s.value} ${unitWord(s.unit)}`.replace(' %', '%')
}
