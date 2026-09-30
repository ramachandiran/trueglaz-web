import { useState } from 'react'
import type { KycDocumentView } from '@trueglaz/core'
import './KycDocuments.css'

const LABELS: Record<string, string> = {
  id_front: 'Document — front',
  id_back: 'Document — back',
  selfie: 'Photo of themselves',
  address_proof: 'Proof of address',
}

/**
 * The documents behind an identity check, for whoever is deciding.
 *
 * Every URL here is a short-lived signed link to the private bucket, minted per
 * request — so this component must not cache them, and a tab left open will
 * stop loading images rather than keep a window onto somebody's papers.
 *
 * Only the newest of each type is shown by default. A rejected seller who sent
 * a clearer copy leaves both behind, and the reviewer wants the one they were
 * asked to look at, not a pile.
 */
export function KycDocuments({ docs }: { docs: KycDocumentView[] }) {
  const [open, setOpen] = useState<KycDocumentView | null>(null)

  if (docs.length === 0) {
    return (
      <p className="kdocs__none">
        No documents were uploaded. There is nothing here to check this against —
        verification will be refused until the seller sends them.
      </p>
    )
  }

  const newest = new Map<string, KycDocumentView>()
  for (const d of docs) if (!newest.has(d.docType)) newest.set(d.docType, d)
  const superseded = docs.length - newest.size

  return (
    <div className="kdocs">
      <ul className="kdocs__grid">
        {[...newest.values()].map((d) => (
          <li key={d.media.id} className="kdocs__item">
            <button type="button" className="kdocs__open" onClick={() => setOpen(d)}>
              <img src={d.media.sizes[400] ?? d.media.url} alt="" loading="lazy" />
              <span className="kdocs__caption">{LABELS[d.docType] ?? d.docType}</span>
            </button>
          </li>
        ))}
      </ul>

      {superseded > 0 && (
        <p className="kdocs__note tg-muted">
          {superseded} earlier {superseded === 1 ? 'upload is' : 'uploads are'} kept on
          the record but not shown — these are the most recent.
        </p>
      )}

      {open && (
        <div className="kdocs__lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <img src={open.media.sizes[1200] ?? open.media.url} alt={LABELS[open.docType] ?? open.docType} />
          <button type="button" className="kdocs__close" aria-label="Close">×</button>
        </div>
      )}
    </div>
  )
}
