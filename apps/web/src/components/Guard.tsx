import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAdmin, isOps, isStaff, useSession } from '@trueglaz/core'
import { Loading } from './ui'

type Need = 'signed-in' | 'staff' | 'ops' | 'admin'

/**
 * Route guard.
 *
 * This only decides what to render. The API enforces the same rules on every
 * call, so a user who edits their way past this gains nothing — hiding a screen
 * is a courtesy to the honest, not a security control.
 */
export function Guard({ need, children }: { need: Need; children: ReactNode }) {
  const { session, ready } = useSession()
  const location = useLocation()

  // Wait for the stored session to be restored, or every reload flashes sign-in.
  if (!ready) return <Loading label="Checking your session" />

  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />
  }

  const allowed =
    need === 'signed-in' ? true
      : need === 'admin' ? isAdmin(session)
        : need === 'staff' ? isStaff(session)
          : isOps(session)

  if (!allowed) return <Navigate to="/" replace />
  return <>{children}</>
}
