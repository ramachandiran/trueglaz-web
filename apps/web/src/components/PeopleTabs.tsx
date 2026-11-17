import { NavLink } from 'react-router-dom'
import { isAdmin, useSession } from '@trueglaz/core'

/**
 * The two halves of People (TG-134): everyone on the platform, and the team
 * that runs it. The team half is admin-only, so staff see no switch at all.
 */
export function PeopleTabs() {
  const { session } = useSession()
  if (!isAdmin(session)) return null
  return (
    <nav className="people-tabs" aria-label="People">
      <NavLink to="/admin/people" end className={({ isActive }) => `people-tabs__tab${isActive ? ' people-tabs__tab--on' : ''}`}>Everyone</NavLink>
      <NavLink to="/admin/people/team" className={({ isActive }) => `people-tabs__tab${isActive ? ' people-tabs__tab--on' : ''}`}>Team &amp; invites</NavLink>
    </nav>
  )
}
