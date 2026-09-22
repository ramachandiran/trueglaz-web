import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, isOps, useSession } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { Timeline } from '../components/Timeline'
import { InspectionReport } from '../components/InspectionReport'
import { GearPhoto, photoKindFor } from '../components/GearPhoto'
import { ErrorNote, GradeBadge, Loading, SeverityBadge } from '../components/ui'
import { buildTimeline, type RenderedReport } from '@trueglaz/core'
import { dateTime, money } from '@trueglaz/core'
import './DetailPage.css'

export function ListingDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const nav = useNavigate()
  const { session, ready } = useSession()
  const listing = useApi(() => api.listing(id), [id])

  const itemId = listing.data?.listing.consignmentItemId
  // The lifecycle lives on the item, and the item record is the seller's — it
  // carries their asking price, floor and bin location. Staff see the provenance
  // here; a shopper gets the grade and the disclosed defects, which is what the
  // listing is actually promising them.
  const canSeeProvenance = isOps(session)
  const item = useApi(
    () => (itemId && canSeeProvenance ? api.item(itemId) : Promise.resolve(null)),
    [itemId, canSeeProvenance],
  )

  const steps = useMemo(
    () =>
      item.data
        ? buildTimeline(item.data.history, item.data.item.currentState, item.data.nextLegalStates)
        : [],
    [item.data],
  )
  const canSeeReport = ready && !!session

  if (listing.loading) return <Loading label="Loading listing" />
  if (listing.error) return <ErrorNote error={listing.error} onRetry={listing.reload} />
  if (!listing.data) return null

  const d = listing.data
  const title = d.listing.title.split('·')[0].trim()
  const kind = photoKindFor(categoryOf(d.listing.title, d.inspectionReport))
  const facts = canSeeReport ? aboutThisItem(d.inspectionReport, d.listing.descriptionGenerated) : []

  return (
    <article className="detail">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">All gear</Link>
        <span aria-hidden="true">›</span>
        <Link to={`/?cat=${kind === 'camera' ? 'cameras' : 'lenses'}`}>
          {kind === 'camera' ? 'Cameras' : 'Lenses'}
        </Link>
        <span aria-hidden="true">›</span>
        <span className="tg-muted">{title}</span>
      </nav>

      <div className="product">
        <div className="product__gallery">
          <GearPhoto kind={kind} size="hero" alt={title} />
          <div className="product__thumbs">
            {[0, 1, 2].map((i) => <GearPhoto key={i} kind={kind} size="thumb" />)}
          </div>
          <p className="product__photo-note tg-muted">
            Photographs of this exact unit are coming. Until then the condition report
            below is the whole truth about it.
          </p>
        </div>

        <div className="product__main">
          <h1 className="product__title">{title}</h1>
          <p className="product__sku tg-mono tg-muted">{d.internalSku}</p>

          <div className="product__grade">
            <GradeBadge code={d.listing.gradeCode} />
            {d.gradeLabel && <strong>{d.gradeLabel}</strong>}
            {d.gradePosition && <span className="tg-muted">· {d.gradePosition}</span>}
          </div>
          {d.gradeDefinition && <p className="product__grade-def tg-muted">{d.gradeDefinition}</p>}

          <hr className="product__rule" />

          <h2 className="product__heading">About this item</h2>
          {facts.length > 0 ? (
            <ul className="product__facts">
              {facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : (
            <p className="tg-muted">
              Sign in to see the inspection-backed details for this unit.
            </p>
          )}

          <h2 className="product__heading">Disclosed defects</h2>
          {d.defects.length === 0 ? (
            <p className="tg-muted">
              The inspection found nothing to disclose. That is a finding, not an absence
              of one — every check is listed below.
            </p>
          ) : (
            <ul className="detail__list">
              {d.defects.map((x) => (
                <li key={x.id} className="detail__defect">
                  <div className="detail__defect-head">
                    <strong>{x.title}</strong>
                    <SeverityBadge severity={x.severity} />
                  </div>
                  <p className="tg-muted detail__defect-body">{x.descriptionPublic}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="buybox" aria-label="Buy">
          <p className="buybox__price">{money(d.listing.priceMinor, d.listing.currency)}</p>
          <p className="buybox__ship tg-muted">+ ₹400 delivery · arrives in 3–5 working days</p>

          {d.listing.state === 'published' ? (
            <>
              <p className="buybox__stock">In stock — and there is only one.</p>
              <button
                className="tg-button buybox__cta"
                onClick={() =>
                  session
                    ? nav(`/checkout/${d.listing.id}`)
                    : nav('/sign-in', { state: { from: `/checkout/${d.listing.id}` } })
                }
              >
                Buy this one
              </button>
              <p className="buybox__hold tg-muted">
                Checkout holds it for 15 minutes so nobody buys it from under you.
              </p>
            </>
          ) : (
            <p className="buybox__gone">
              This one has been {d.listing.state}. Nothing else is quite like it —
              <Link to="/"> see what else is in</Link>.
            </p>
          )}

          <hr className="product__rule" />

          <dl className="buybox__terms">
            <div><dt>Sold by</dt><dd>TrueGlaz</dd></div>
            <div><dt>Graded by</dt><dd>TrueGlaz, then checked again by QC</dd></div>
            <div><dt>Your money</dt><dd>Held in escrow until you accept the parcel</dd></div>
            <div><dt>Returns</dt><dd>If it is not as graded, it goes back</dd></div>
          </dl>
        </aside>
      </div>

      {d.inspectionReport && (canSeeReport ? (
        <section className="tg-card detail__section">
          <h2 className="detail__section-title">The full condition report</h2>
          <p className="detail__blurb tg-muted">
            Every check a TrueGlaz technician recorded on this exact unit, signed off by a
            second pair of eyes. Buying used online means trusting someone else's eyes —
            so here are all of them, not a summary.
          </p>
          <InspectionReport report={d.inspectionReport} audience="buyer" />
        </section>
      ) : (
        <section className="tg-card detail__section">
          <h2 className="detail__section-title">The full condition report</h2>
          <p className="detail__blurb tg-muted">
            Sign in to see the inspection report for this unit.
          </p>
          <Link
            to="/sign-in"
            state={{ from: location.pathname + location.search }}
            className="tg-button tg-button--primary"
          >
            Sign in to view report
          </Link>
        </section>
      ))}

      {steps.length > 0 && (
        <section className="tg-card detail__section">
          <div className="detail__section-head">
            <h2 className="detail__section-title">Where this unit has been</h2>
            {itemId && <Link to={`/items/${itemId}`}>Full item record →</Link>}
          </div>
          <Timeline steps={steps} orientation="horizontal" />
        </section>
      )}

      {d.priceHistory.length > 0 && (
        <section className="tg-card detail__section">
          <h2 className="detail__section-title">Price history</h2>
          <table className="detail__table">
            <thead>
              <tr><th>From</th><th>To</th><th>Reason</th><th>When</th></tr>
            </thead>
            <tbody>
              {d.priceHistory.map((p) => (
                <tr key={p.id}>
                  <td>{money(p.oldAmountMinor)}</td>
                  <td>{money(p.newAmountMinor)}</td>
                  <td>{p.reason.replace(/_/g, ' ')}</td>
                  <td className="tg-muted">{dateTime(p.changedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
  )
}

/**
 * The handful of answers a buyer wants before scrolling: what it is, how hard
 * it has been used, and whether the paperwork is there.
 *
 * Drawn from the report rather than written by hand, so it cannot drift from
 * what the technician actually recorded.
 */
function aboutThisItem(report: RenderedReport | null | undefined, fallback: string | null): string[] {
  if (!report) return fallback ? [fallback] : []
  const answers = new Map(report.sections.flatMap((s) => s.answers).map((a) => [a.code, a]))
  const say = (code: string, phrase: (value: string, unit: string | null) => string) => {
    const a = answers.get(code)
    return a?.displayValue ? phrase(a.displayValue, a.unit) : null
  }

  return [
    report.verifiedShutterCount != null
      ? `Shutter count verified at ${report.verifiedShutterCount.toLocaleString()} actuations`
      : null,
    say('year_of_manufacture', (v) => `Made in ${v}`),
    say('warranty_status', (v) => v === 'in warranty'
      ? `Still under manufacturer warranty${answers.get('warranty_expiry')?.displayValue ? `, to ${answers.get('warranty_expiry')!.displayValue}` : ''}`
      : `Manufacturer warranty: ${v}`),
    say('purchase_proof', (v) => v === 'both'
      ? 'Original invoice and box included'
      : `Paperwork: ${v.replace(/_/g, ' ')}`),
    say('serial_verified', (v) => v === 'Yes'
      ? 'Serial number checked against the body and the blocklist'
      : 'Serial number could not be verified'),
    say('sensor_condition', (v) => `Sensor ${v}`),
    say('front_element', (v) => `Front element ${v}`),
    say('caps_hood', (v) => v === 'Yes' ? 'Caps and hood included' : 'No caps or hood'),
    say('charger_included', (v) => v === 'Yes' ? 'Charger included' : 'No charger'),
    `${report.answeredCount} checks recorded, signed off by QC`,
  ].filter((x): x is string => x !== null).slice(0, 7)
}

/** The report's own sections say which kind of gear was inspected. */
function categoryOf(title: string, report: RenderedReport | null | undefined): string {
  if (report?.sections.some((s) => s.section === 'Shutter')) return 'Cameras'
  if (report?.sections.some((s) => s.section === 'Optics')) return 'Lenses'
  return /mm|f\/\d/.test(title) ? 'Lenses' : 'Cameras'
}
