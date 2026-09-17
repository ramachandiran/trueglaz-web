import { useEffect, useRef } from 'react'
import { STATE_BLURBS, type TimelineStep } from '../lib/lifecycle'
import { dateTime, relative } from '../lib/format'
import './Timeline.css'

interface Props {
  steps: TimelineStep[]
  /** Horizontal reads as a journey; vertical suits a narrow column. */
  orientation?: 'horizontal' | 'vertical'
}

/**
 * The item lifecycle as one line: what is done, where it is now, what is ahead.
 *
 * The line is drawn as a track behind the nodes and a fill over it, so progress
 * reads at a glance before any label is read. Colour never carries meaning on
 * its own — each node also has a distinct glyph and its status in text.
 */
export function Timeline({ steps, orientation = 'horizontal' }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLLIElement>(null)

  // A long lifecycle overflows its container, and the part that matters — where
  // the item is now and what is next — sits at the far end. Bring it into view
  // rather than leaving the reader to discover a scrollbar.
  useEffect(() => {
    const el = currentRef.current
    const box = scroller.current
    if (!el || !box || orientation !== 'horizontal') return
    if (box.scrollWidth <= box.clientWidth) return
    box.scrollTo({
      left: Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2),
      behavior: 'smooth',
    })
  }, [steps, orientation])

  if (!steps.length) return null

  return (
    <div ref={scroller} className={`tl tl--${orientation}`} role="list" aria-label="Item lifecycle">
      <ol className="tl__steps">
        {steps.map((step) => (
          <li
            key={step.state}
            ref={step.status === 'current' ? currentRef : undefined}
            role="listitem"
            className={`tl__step tl__step--${step.status}${step.detour ? ' tl__step--detour' : ''}`}
          >
            <span className="tl__node" aria-hidden="true">
              {step.status === 'done' ? '✓' : step.status === 'current' ? '●' : ''}
            </span>

            <div className="tl__body">
              <span className="tl__label">{step.label}</span>
              <span className="tl__meta">
                {step.status === 'upcoming' ? (
                  <span className="tl__pending">Not yet</span>
                ) : (
                  <time dateTime={step.occurredAt} title={dateTime(step.occurredAt)}>
                    {relative(step.occurredAt)}
                  </time>
                )}
              </span>
              {step.actorRole && step.status !== 'upcoming' && (
                <span className="tl__role">by {step.actorRole}</span>
              )}
              {step.reasonCode && <span className="tl__reason">{step.reasonCode}</span>}
            </div>

            {/* Screen readers get the status and the explanation as words. */}
            <span className="tg-visually-hidden">
              {step.status === 'done'
                ? 'Completed'
                : step.status === 'current'
                  ? 'Current state'
                  : 'Upcoming'}
              . {STATE_BLURBS[step.state] ?? ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
