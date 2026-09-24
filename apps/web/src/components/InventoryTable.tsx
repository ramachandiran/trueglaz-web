import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { STATE_LABELS, dateOnly, dateTime, money, type InventoryRow } from '@trueglaz/core'
import { StateBadge } from './ui'
import './InventoryTable.css'

/**
 * Every unit the platform holds, one row each.
 *
 * Each column carries its own dropdown, built from the values actually present
 * rather than from a fixed list: a filter offering "Fujifilm" when no Fujifilm
 * has ever been consigned wastes the one glance it was meant to save. Picking
 * one narrows every other dropdown too, so the filters describe what is left
 * rather than what once was.
 *
 * A row opens to the whole record. The table shows what you scan by; the
 * expansion shows everything, because the question this page exists to answer
 * is sometimes "what on earth happened to that one".
 */
export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'sku', desc: false })

  const set = (key: string, value: string) =>
    setFilters((f) => {
      const next = { ...f }
      if (value) next[key] = value
      else delete next[key]
      return next
    })

  // Each dropdown's options come from the rows that survive every OTHER
  // filter, so the choices on offer are always ones that would return something.
  const optionsFor = (key: string) => {
    const others = Object.entries(filters).filter(([k]) => k !== key)
    const pool = rows.filter((r) => others.every(([k, v]) => valueOf(r, k) === v))
    return [...new Set(pool.map((r) => valueOf(r, key)).filter(Boolean))].sort() as string[]
  }

  const visible = useMemo(() => {
    const kept = rows.filter((r) =>
      Object.entries(filters).every(([k, v]) => valueOf(r, k) === v))
    const dir = sort.desc ? -1 : 1
    return [...kept].sort((a, b) => dir * compare(a, b, sort.key))
  }, [rows, filters, sort])

  const active = Object.keys(filters).length
  const openRow = visible.find((r) => r.id === open) ?? null

  return (
    <div className="stock">
      <div className="stock__bar">
        <span className="stock__count">
          <strong>{visible.length}</strong> of {rows.length} units
        </span>
        {active > 0 && (
          <button type="button" className="tg-button stock__clear" onClick={() => setFilters({})}>
            Clear {active} filter{active > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div className="stock__scroll">
        <table className="stock__table">
          <thead>
            <tr className="stock__head">
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col">
                  <button
                    type="button"
                    className="stock__sort"
                    onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : false }))}
                    aria-label={`Sort by ${c.label}`}
                  >
                    {c.label}
                    {sort.key === c.key && <span aria-hidden="true">{sort.desc ? ' ↓' : ' ↑'}</span>}
                  </button>
                </th>
              ))}
            </tr>
            <tr className="stock__filters">
              {COLUMNS.map((c) => (
                <th key={c.key}>
                  {c.filter ? (
                    <select
                      className="tg-select stock__select"
                      value={filters[c.key] ?? ''}
                      onChange={(e) => set(c.key, e.target.value)}
                      aria-label={`Filter by ${c.label}`}
                    >
                      <option value="">All</option>
                      {optionsFor(c.key).map((o) => (
                        <option key={o} value={o}>{c.optionLabel ? c.optionLabel(o) : o}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="stock__nofilter" aria-hidden="true">—</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visible.map((r) => (
              <Fragment key={r.id}>
                <tr
                  className={`stock__row${open === r.id ? ' stock__row--open' : ''}`}
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                >
                  <td>
                    <button type="button" className="stock__sku" aria-expanded={open === r.id}>
                      <span aria-hidden="true" className="stock__caret">{open === r.id ? '▾' : '▸'}</span>
                      <span className="tg-mono">{r.internalSku}</span>
                    </button>
                  </td>
                  <td>
                    <span className="stock__item">{itemName(r)}</span>
                    <span className="stock__sub tg-muted">{r.brandName ?? '—'}</span>
                  </td>
                  <td>{r.categoryName ?? '—'}</td>
                  <td><StateBadge state={r.currentState} /></td>
                  <td>
                    {r.assignedGradeCode ?? <span className="tg-muted">{r.declaredGradeCode} declared</span>}
                  </td>
                  <td>{r.sellerName ?? '—'}</td>
                  <td>{r.binCode ?? <span className="tg-muted">—</span>}</td>
                  <td className="stock__num">{r.listingPriceMinor != null ? money(r.listingPriceMinor) : (r.askingAmountMinor != null ? <span className="tg-muted">{money(r.askingAmountMinor)} asked</span> : '—')}</td>
                  <td>{r.listingState ?? <span className="tg-muted">—</span>}</td>
                  <td>{r.orderState ?? <span className="tg-muted">—</span>}</td>
                  <td>{r.payoutState ?? <span className="tg-muted">—</span>}</td>
                  <td className="tg-muted stock__when">{dateOnly(r.updatedAt)}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="stock__empty tg-muted">Nothing matches those filters.</p>
      )}

      {/*
        Below the table rather than inside it. The table scrolls sideways — it
        has to, a unit's whole life does not fit in a viewport — and a detail
        panel nested in that scroll gets cut off at the table's right edge,
        which is exactly where half the facts were.
      */}
      {openRow && <ItemDossier row={openRow} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** Everything the platform knows about one unit, grouped the way it happened. */
function ItemDossier({ row: r, onClose }: { row: InventoryRow; onClose: () => void }) {
  return (
    <div className="dossier">
      <div className="dossier__head">
        <div>
          <h3 className="dossier__title">{itemName(r)}</h3>
          <span className="tg-mono tg-muted dossier__sku">{r.internalSku}</span>
        </div>
        <span className="dossier__actions">
          <Link to={`/items/${r.id}`} className="tg-button dossier__open">Open its timeline</Link>
          <button type="button" className="tg-button dossier__open" onClick={onClose}>Close</button>
        </span>
      </div>

      <div className="dossier__grid">
        <Group title="What it is">
          <Fact k="Internal SKU" v={r.internalSku} mono />
          <Fact k="Serial number" v={r.serialNumber} mono />
          <Fact k="Type" v={r.categoryName} />
          <Fact k="Brand" v={r.brandName} />
          <Fact k="Model" v={r.modelName ?? r.modelFreeText} />
          <Fact k="Catalogue match" v={r.fromCatalogue ? 'Linked to a catalogue model' : 'Seller’s own words'} />
          <Fact k="Description" v={r.description} wide />
          <Fact k="Reason for selling" v={r.reasonToSell} wide />
        </Group>

        <Group title="Condition">
          <Fact k="Seller declared" v={r.declaredGradeCode} />
          <Fact k="Graded by us" v={r.assignedGradeCode} />
          <Fact k="Under warranty" v={yesNo(r.underWarranty)} />
          <Fact k="Comes with" v={comesWith(r)} />
          <Fact k="Shutter count" v={r.shutterCount?.toLocaleString()} />
          <Fact k="Defects found" v={`${r.defectCount} (${r.disclosedDefectCount} disclosed)`} />
        </Group>

        <Group title="Money">
          <Fact k="Asking price" v={r.askingAmountMinor != null ? money(r.askingAmountMinor) : null} />
          <Fact k="Seller’s floor" v={r.floorAmountMinor != null ? money(r.floorAmountMinor) : null} />
          <Fact k="Declared value" v={r.declaredValueMinor != null ? money(r.declaredValueMinor) : null} />
          <Fact k="Listed at" v={r.listingPriceMinor != null ? money(r.listingPriceMinor) : null} />
          <Fact k="Our commission" v={r.commissionMinor != null ? money(r.commissionMinor) : null} />
          <Fact k="Seller receives" v={r.expectedNetMinor != null ? money(r.expectedNetMinor) : null} />
        </Group>

        <Group title="Who and where">
          <Fact k="Seller" v={r.sellerName} />
          <Fact k="Seller contact" v={r.sellerEmail} />
          <Fact k="Submission" v={r.submissionState} />
          <Fact k="Pricing mode" v={r.pricingMode} />
          <Fact k="Courier" v={r.courierCode} />
          <Fact k="Tracking" v={r.trackingNumber} mono />
          <Fact k="Inbound" v={r.shipmentState} />
          <Fact k="Storage bin" v={r.binCode ? `${r.binCode}${r.binZone ? ` · ${r.binZone}` : ''}` : null} />
          <Fact k="Quarantine bin" v={r.isQuarantineBin == null ? null : yesNo(r.isQuarantineBin)} />
        </Group>

        <Group title="Inspection">
          <Fact k="QC" v={r.inspectionQcState} />
          <Fact k="Outcome" v={r.inspectionOutcome} />
          <Fact k="Technician" v={r.technicianName} />
          <Fact k="Signed off by" v={r.qcName} />
        </Group>

        <Group title="Sale">
          <Fact k="Listing" v={r.listingState} />
          <Fact k="Listing title" v={r.listingTitle} wide />
          <Fact k="Order" v={r.orderNumber} mono />
          <Fact k="Order state" v={r.orderState} />
          <Fact k="Line state" v={r.orderLineState} />
          <Fact k="Buyer" v={r.buyerName} />
          <Fact k="Payout" v={r.payoutState} />
          <Fact k="Payout amount" v={r.payoutNetMinor != null ? money(r.payoutNetMinor) : null} />
          <Fact k="Paid at" v={r.payoutPaidAt ? dateTime(r.payoutPaidAt) : null} />
        </Group>

        <Group title="Dates">
          <Fact k="State" v={STATE_LABELS[r.currentState] ?? r.currentState} />
          <Fact k="Created" v={dateTime(r.createdAt)} />
          <Fact k="Listed" v={r.listedAt ? dateTime(r.listedAt) : null} />
          <Fact k="Sold" v={r.soldAt ? dateTime(r.soldAt) : null} />
          <Fact k="Consignment expires" v={r.consignmentExpiresAt ? dateTime(r.consignmentExpiresAt) : null} />
          <Fact k="Last change" v={dateTime(r.updatedAt)} />
        </Group>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dossier__group">
      <h4 className="dossier__group-title">{title}</h4>
      <dl className="dossier__facts">{children}</dl>
    </section>
  )
}

/**
 * A fact we do not hold is shown as a dash rather than hidden. On a page whose
 * job is completeness, a missing row and an absent field look identical, and
 * only one of them is a problem.
 */
function Fact({ k, v, mono, wide }: { k: string; v?: string | null; mono?: boolean; wide?: boolean }) {
  return (
    <div className={`dossier__fact${wide ? ' dossier__fact--wide' : ''}`}>
      <dt>{k}</dt>
      <dd className={mono ? 'tg-mono' : undefined}>{v || <span className="tg-muted">—</span>}</dd>
    </div>
  )
}

const yesNo = (b: boolean | null | undefined) => (b == null ? null : b ? 'Yes' : 'No')

function comesWith(r: InventoryRow): string {
  const parts = [r.hasBill && 'original bill', r.hasAccessories ? 'box with accessories' : r.hasBox && 'original box']
    .filter(Boolean) as string[]
  return parts.length ? parts.join(', ') : 'nothing'
}

const itemName = (r: InventoryRow) =>
  r.modelName ?? r.modelFreeText ?? r.listingTitle ?? 'Unnamed unit'

type SortKey = 'sku' | 'item' | 'category' | 'state' | 'grade' | 'seller' | 'bin' | 'price' | 'listing' | 'order' | 'payout' | 'updated'

const COLUMNS: { key: SortKey; label: string; filter: boolean; optionLabel?: (v: string) => string }[] = [
  { key: 'sku', label: 'SKU', filter: false },
  { key: 'item', label: 'Item', filter: false },
  { key: 'category', label: 'Type', filter: true },
  { key: 'state', label: 'State', filter: true, optionLabel: (v) => STATE_LABELS[v] ?? v },
  { key: 'grade', label: 'Grade', filter: true },
  { key: 'seller', label: 'Seller', filter: true },
  { key: 'bin', label: 'Bin', filter: true },
  { key: 'price', label: 'Price', filter: false },
  { key: 'listing', label: 'Listing', filter: true },
  { key: 'order', label: 'Order', filter: true },
  { key: 'payout', label: 'Payout', filter: true },
  { key: 'updated', label: 'Updated', filter: false },
]

/** One place that says what a column means, so filtering and sorting agree. */
function valueOf(r: InventoryRow, key: string): string {
  switch (key) {
    case 'sku': return r.internalSku
    case 'item': return itemName(r)
    case 'category': return r.categoryName ?? ''
    case 'state': return r.currentState
    case 'grade': return r.assignedGradeCode ?? r.declaredGradeCode ?? ''
    case 'seller': return r.sellerName ?? ''
    case 'bin': return r.binCode ?? ''
    case 'listing': return r.listingState ?? ''
    case 'order': return r.orderState ?? ''
    case 'payout': return r.payoutState ?? ''
    default: return ''
  }
}

function compare(a: InventoryRow, b: InventoryRow, key: SortKey): number {
  if (key === 'price') {
    return (a.listingPriceMinor ?? a.askingAmountMinor ?? 0) - (b.listingPriceMinor ?? b.askingAmountMinor ?? 0)
  }
  if (key === 'updated') return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '')
  return valueOf(a, key).localeCompare(valueOf(b, key))
}
