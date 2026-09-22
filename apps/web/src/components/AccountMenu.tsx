import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '@trueglaz/core'
import './AccountMenu.css'

/**
 * Who you are, top right, and everything that belongs to you behind it.
 *
 * The header used to carry a name and a Sign out button, which meant the only
 * thing a person could do with their own account was leave it. This is the
 * doorway to the rest: details, addresses, where the money goes, and what is
 * signed in as them.
 */
export function AccountMenu() {
  const { session, signOut } = useSession()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // A menu that stays open when you click elsewhere, or press Escape, reads as
  // stuck rather than open.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!session) return null

  return (
    <div className="account" ref={box}>
      <button
        className="account__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="account__avatar" aria-hidden="true">{initials(session.displayName)}</span>
        <span className="account__name">{session.displayName}</span>
        <span className="account__caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="account__menu" role="menu">
          <div className="account__head">
            <span className="account__avatar account__avatar--lg" aria-hidden="true">
              {initials(session.displayName)}
            </span>
            <div className="account__head-text">
              <strong>{session.displayName}</strong>
              {session.email && <span className="tg-muted account__email">{session.email}</span>}
              {session.roles.length > 0 && (
                <span className="account__roles">{session.roles.join(' · ')}</span>
              )}
            </div>
          </div>

          <div className="account__links">
            <Link className="account__link" role="menuitem" to="/profile" onClick={() => setOpen(false)}>
              Profile &amp; settings
            </Link>
            <Link className="account__link" role="menuitem" to="/profile#addresses" onClick={() => setOpen(false)}>
              Delivery addresses
            </Link>
            <Link className="account__link" role="menuitem" to="/profile#bank" onClick={() => setOpen(false)}>
              Bank details
            </Link>
            <Link className="account__link" role="menuitem" to="/profile#security" onClick={() => setOpen(false)}>
              Sign-in &amp; security
            </Link>
            <Link className="account__link" role="menuitem" to="/orders" onClick={() => setOpen(false)}>
              My orders
            </Link>
          </div>

          <button
            className="account__link account__signout"
            role="menuitem"
            onClick={async () => { setOpen(false); await signOut(); nav('/') }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** Two letters from a name, which is a kinder placeholder than a stock avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
