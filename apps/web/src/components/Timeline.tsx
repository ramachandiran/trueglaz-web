import { useEffect, useRef } from 'react'
import { STATE_BLURBS, type TimelineStep } from '@trueglaz/core'
import { dateTime, relative } from '@trueglaz/core'
import './Timeline.css'

interface Props {
  steps: TimelineStep[]
  /** Horizontal reads as a journey; vertical suits a narrow column. */
  orientation?: 'horizontal' | 'vertical'
  /** Reason codes by code, so a node can print the words rather than ist_grading_error. */
  reasons?: Record<string, string>
}

/**
 * The item lifecycle as one line: what is done, where it is now, what is ahead.
 *
 * The line is drawn as a track behind the nodes and a fill over it, so progress
 * reads at a glance before any label is read. Colour never carries meaning on
 * its own — each node also has a distinct glyph and its status in text.
 */
export function Timeline({ steps, orientation = 'horizontal', reasons = {} }: Props) {
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
              {step.status === 'done' ? '✓'
                : step.status === 'current' ? '●'
                  : step.status === 'undone' ? '↺' : ''}
            </span>

            {/* The note is prose, and a node on the horizontal line is 80px
                wide. It is carried as a tooltip here and printed in full by the
                history card under the line; stacked vertically there is room. */}
            <div className="tl__body" title={step.note ?? undefined}>
              <span className="tl__label">
                {step.label}
                {/* An item can walk the same stage several times. One node with
                    one timestamp hid every pass but the last. */}
                {step.visits != null && step.visits > 1 && (
                  <span className="tl__visits" title={`Entered ${step.visits} times`}>
                    ×{step.visits}
                  </span>
                )}
              </span>
              <span className="tl__meta">
                {step.status === 'upcoming' ? (
                  <span className="tl__pending">Not yet</span>
                ) : (
                  <time dateTime={step.occurredAt} title={dateTime(step.occurredAt)}>
                    {relative(step.occurredAt)}
                  </time>
                )}
              </span>
              {step.status === 'undone' && (
                <span className="tl__undone">went back from here</span>
              )}
              {step.actorRole && step.status !== 'upcoming' && (
                <span className="tl__role">by {step.actorRole}</span>
              )}
              {step.reasonCode && (
                <span className="tl__reason">{reasons[step.reasonCode] ?? step.reasonCode}</span>
              )}
              {step.note && orientation === 'vertical' && (
                <span className="tl__note">“{step.note}”</span>
              )}
            </div>

            {/* Screen readers get the status and the explanation as words. */}
            <span className="tg-visually-hidden">
              {step.status === 'done'
                ? 'Completed'
                : step.status === 'current'
                  ? 'Current state'
                  : step.status === 'undone'
                    ? 'Reached earlier, then the item was moved back'
                    : 'Upcoming'}
              . {STATE_BLURBS[step.state] ?? ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
