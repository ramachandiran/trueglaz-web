import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useConsoleTitle } from './consoleTitle'
import { Icon, ICONS } from './StaffShell'

/**
 * A console screen's heading (TG-194): where you are, what this is, and the
 * screen's own actions on the right - the template's "Welcome back" row.
 *
 * A screen with nothing to add calls useConsoleTitle and the shell draws this
 * for it; one with actions (Export, Pass inspection…) draws it itself.
 */
export interface PageHeadProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Where this sits, outermost first; the last one is this screen and is not a link. */
  crumbs?: { label: string; to?: string }[]
  badge?: ReactNode
  actions?: ReactNode
}

export function PageHead(props: PageHeadProps) {
  useConsoleTitle(typeof props.title === 'string' ? props.title : '', undefined, true)
  return <PageHeadView {...props} />
}

/** The heading itself, for the shell to draw on a screen's behalf. */
export function PageHeadView({ title, subtitle, crumbs, badge, actions }: PageHeadProps) {
  return (
    <div className="c-head">
      <div className="c-head__text">
        {crumbs && crumbs.length > 0 && (
          <nav className="c-crumbs" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((c, i) => (
                <li key={i}>
                  {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                  {i < crumbs.length - 1 && <Icon d={ICONS.chevron} />}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="c-head__title">{title}{badge}</h1>
        {subtitle && <p className="c-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="c-head__actions">{actions}</div>}
    </div>
  )
}
