import './ui.css'

/** Grade badge. TG-10 is best; the colour band follows the rank, not the label. */
export function GradeBadge({ code, rank }: { code: string; rank?: number }) {
  const tone = rank === undefined ? '' : rank >= 9 ? 'good' : rank >= 7 ? 'accent' : 'warn'
  return <span className={`tg-badge${tone ? ` tg-badge--${tone}` : ''}`}>{code}</span>
}

/** Item state badge, coloured by whether the state is good news, a hold, or an end. */
export function StateBadge({ state }: { state: string }) {
  const bad = ['REJECTED_PRE_INTAKE', 'INSPECTION_FAILED', 'QUARANTINED', 'SELLER_DECLINED', 'RETURNED']
  const warn = ['RETURN_REQUESTED', 'RETURN_TO_SELLER', 'UNSOLD_REVIEW', 'AWAITING_SELLER_APPROVAL']
  const good = ['ACCEPTED', 'LISTED', 'DELIVERED']
  const tone = bad.includes(state) ? 'bad' : warn.includes(state) ? 'warn' : good.includes(state) ? 'good' : ''
  return <span className={`tg-badge${tone ? ` tg-badge--${tone}` : ''}`}>{state.replace(/_/g, ' ')}</span>
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone = severity === 'optical' ? 'bad' : severity === 'functional' ? 'warn' : ''
  return <span className={`tg-badge${tone ? ` tg-badge--${tone}` : ''}`}>{severity}</span>
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      <span className="tg-visually-hidden">{label}</span>
      <div className="tg-skeleton ui-loading__bar" />
      <div className="tg-skeleton ui-loading__bar ui-loading__bar--short" />
      <div className="tg-skeleton ui-loading__bar" />
    </div>
  )
}

/** Errors show the API's own message, which is usually the actual explanation. */
export function ErrorNote({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="ui-error tg-card" role="alert">
      <strong className="ui-error__title">Something went wrong</strong>
      <p className="ui-error__msg">{error.message}</p>
      {onRetry && (
        <button type="button" className="tg-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="ui-empty tg-card">
      <strong>{title}</strong>
      {hint && <p className="tg-muted ui-empty__hint">{hint}</p>}
    </div>
  )
}
