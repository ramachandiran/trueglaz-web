import { Link } from 'react-router-dom'
import { api, useApi, type PlatformSetting } from '@trueglaz/core'
import { fromPaise, unitWord } from './SettingRow'

/**
 * The settings at a glance: each group's headline values and anything that
 * needs attention (company details not set up, a payment gateway in test mode,
 * models without photos), each card a way into its page.
 */
export function SettingsOverview() {
  const settings = useApi(() => api.adminSettings(), [])
  const fees = useApi(() => api.adminFees(), [])
  const company = useApi(() => api.adminCompany(), [])
  const meta = useApi(() => api.meta(), [])
  const models = useApi(() => api.adminModels({}), [])

  const s = new Map((settings.data ?? []).map((x) => [x.key, x]))
  const v = (k: string) => show(s.get(k))
  const gateway = meta.data?.paymentGateway === 'razorpay' ? 'Razorpay' : 'Demo gateway'

  return (
    <section>
      <h2 className="st__h">Overview</h2>
      <p className="st__lede">Everything the platform can be told, by topic. Changes take effect without a deploy, and every one is recorded.</p>

      <div className="st__grid">
        <Card to="selling" title="Selling & checkout" items={[
          ['Return window', v('return_window_hours')], ['Checkout hold', v('reservation_timeout_minutes')],
          ['Seller answers a price within', v('seller_approval_days')],
        ]} />
        <Card to="fees" title="Fees & commission" items={[
          ['Commission', (fees.data?.commissionBands ?? []).map((b) => `${b.percent}%`).join(' / ') || '—'],
          ['GST on commission', v('commission_gst_percent')], ['Delivery charge', v('shipping_flat_minor')],
        ]} />
        <Card to="payouts" title="Payouts" items={[
          ['Staff may send payouts up to', v('payout_auto_release_max_minor')],
          ['Payment gateway', meta.data ? `${gateway}${meta.data.paymentsAreReal ? ' · live' : ' · test / demo'}` : '—'],
        ]} warn={meta.data && !meta.data.paymentsAreReal ? 'Payments are not taking real money' : undefined} />
        <Card to="company" title="Company & invoices" items={[
          ['Legal name', company.data?.profile.legalName || '—'], ['GSTIN', company.data?.profile.gstin || '—'],
        ]} warn={company.data?.source === 'server' ? 'Not set up here yet — invoices use the server configuration' : undefined} />
        <Card to="security" title="Sign-in & security" items={[
          ['Sign-in code valid for', v('otp_ttl_seconds')], ['Stay signed in for', v('session_ttl_days')],
        ]} />
        <Card to="models" title="Model photos" items={[
          ['With a photograph', models.data ? `${models.data.counts.photo} of ${models.data.counts.total}` : '—'],
        ]} warn={models.data && models.data.counts.photo < models.data.counts.total ? `${models.data.counts.total - models.data.counts.photo} models still need one` : undefined} />
      </div>
    </section>
  )
}

function Card({ to, title, items, warn }: { to: string; title: string; items: [string, string][]; warn?: string }) {
  return (
    <Link to={`/admin/settings/${to}`} className="st__tile">
      <span className="st__tile-title">{title} <span aria-hidden="true">→</span></span>
      <dl>
        {items.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
      </dl>
      {warn && <span className="st__tile-warn">{warn}</span>}
    </Link>
  )
}

function show(s?: PlatformSetting): string {
  if (!s) return '—'
  if (s.unit === 'rupees') return `₹${Number(fromPaise(s.value)).toLocaleString('en-IN')}`
  return `${s.value} ${unitWord(s.unit)}`.replace(' %', '%')
}
