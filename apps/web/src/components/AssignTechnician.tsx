import { useState } from 'react'
import { api, ApiError, isStaff, useApi, useSession, type Technician } from '@trueglaz/core'
import './AssignTechnician.css'

/**
 * Who is meant to inspect this unit.
 *
 * It exists outside the state-change dialog because the move that matters most
 * is one staff cannot make: RECEIVED → IN_INSPECTION belongs to Technician and
 * Admin, by the same separation of duties that stops the person who graded an
 * item signing off their own grade. So a staff member hands a unit out while it
 * is still RECEIVED, and the technician starts it themselves.
 *
 * Assignment is intent. The inspection report still records whoever actually
 * opened the checklist, and the two are allowed to disagree — somebody picking
 * up a colleague's unit has still inspected it.
 */
export function AssignTechnician({
  itemId,
  assignedTo,
  onDone,
}: {
  itemId: string
  assignedTo: string | null
  onDone: () => void
}) {
  const { session } = useSession()
  const staff = isStaff(session)
  const roster = useApi(() => api.technicians(), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const people: Technician[] = roster.data ?? []
  const name = people.find((t) => t.id === assignedTo)?.displayName ?? null

  async function set(id: string) {
    setBusy(true); setError(null)
    try {
      await api.assignTechnician(itemId, id || null)
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not assign that')
    } finally {
      setBusy(false)
    }
  }

  // A technician sees whose bench it is on; only staff can move it.
  if (!staff) {
    return (
      <p className="asn asn--read tg-muted">
        {name ? <>On <strong>{name}</strong>’s bench</> : 'Not assigned to anybody'}
      </p>
    )
  }

  return (
    <div className="asn">
      <label className="asn__label" htmlFor={`asn-${itemId}`}>Inspection assigned to</label>
      <select
        id={`asn-${itemId}`}
        className="tg-select asn__select"
        value={assignedTo ?? ''}
        disabled={busy || roster.loading}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">Nobody yet</option>
        {people.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
      </select>
      {error && <p className="asn__error" role="alert">{error}</p>}
    </div>
  )
}
