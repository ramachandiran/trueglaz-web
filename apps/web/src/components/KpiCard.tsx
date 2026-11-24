import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, ICONS } from './StaffShell'

/**
 * The console's figure card (TG-194/199): icon, title, a big value, then a
 * chip and a line. One component for every screen, so the Control room and a
 * queue's summary read as the same product.
 *
 * It is a link when it opens a list, a toggle button when it filters the list
 * under it (pressed = that filter is on), and a plain card otherwise.
 */
export function KpiCard({ icon, title, value, unit, chip, note, lead, to, onClick, pressed, tone }: {
  icon: string
  title: string
  value: ReactNode
  /** A small unit after the value: "h", "days". */
  unit?: string
  chip?: ReactNode
  note?: ReactNode
  /** The screen's headline figure: its icon is filled orange. */
  lead?: boolean
  to?: string
  onClick?: () => void
  pressed?: boolean
  /** Edge colour when the figure needs a person. */
  tone?: 'bad' | 'warn'
}) {
  const body = (
    <>
      <span className="c-kpi2__t">
        <span className={`c-kpi2__ico${lead ? ' c-kpi2__ico--on' : ''}`}><Icon d={icon} /></span>
        {title}
        {(to || onClick) && <span className="c-kpi2__info c-kpi__go"><Icon d={to ? ICONS.arrow : ICONS.filter} /></span>}
      </span>
      <span className="c-kpi2__v">{value}{unit && <small> {unit}</small>}</span>
      {(chip || note) && <span className="c-kpi2__f">{chip}{note && <span>{note}</span>}</span>}
    </>
  )
  const cls = `c-card c-kpi2${tone ? ` c-kpi2--${tone}` : ''}${pressed ? ' c-kpi2--on' : ''}`
  if (to) return <Link to={to} className={`${cls} c-hit`}>{body}<span className="tg-visually-hidden"> Open the list.</span></Link>
  if (onClick) return <button type="button" className={`${cls} c-hit`} aria-pressed={!!pressed} onClick={onClick}>{body}</button>
  return <div className={cls}>{body}</div>
}

/** A row of figure cards: four across on a wide screen, two on a tablet, one on a phone. */
export function KpiRow({ label, children, cols }: { label: string; children: ReactNode; cols?: 3 | 4 | 5 }) {
  return <section className={`c-kpis${cols ? ` c-kpis--${cols}` : ''}`} aria-label={label}>{children}</section>
}
