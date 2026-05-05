import { useCallback, useMemo, useState } from 'react'
import { useSessions, useCancelSession } from '@/lib/queries/sessions'
import { useAllWorkoutDays } from '@/lib/queries/plans'
import { fmtDate, fmtDuration } from '@/lib/format'
import { SessionDetail } from './SessionDetail'

export function PastSessionsList() {
  const sessions = useSessions()
  const days = useAllWorkoutDays()
  const cancel = useCancelSession()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const dayNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of days.data ?? []) m.set(d.id, d.name)
    return m
  }, [days.data])

  // Memoize session list items with computed durations to avoid recalculating on every render
  const sessionItems = useMemo(() => {
    return (sessions.data ?? []).map((s) => {
      const durationMs =
        s.ended_at && s.started_at ? new Date(s.ended_at).getTime() - new Date(s.started_at).getTime() : null
      return { ...s, durationMs }
    })
  }, [sessions.data])

  const onDelete = useCallback(
    (e: React.MouseEvent, id: string, label: string) => {
      e.stopPropagation()
      if (!window.confirm(`Delete ${label}? All sets from this session will be removed.`)) return
      cancel.mutate({ id })
    },
    [cancel],
  )

  const handleBack = useCallback(() => setSelectedId(null), [])

  if (sessions.isLoading) {
    return <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>
  }

  if (sessionItems.length === 0) {
    return <p className="text-sm text-[color:var(--color-muted)]">No sessions yet.</p>
  }

  if (selectedId) {
    const selected = sessionItems.find((s) => s.id === selectedId)
    const name = selected ? dayNameById.get(selected.workout_day_id) ?? 'Workout' : 'Workout'
    return <SessionDetail sessionId={selectedId} dayName={name} onBack={handleBack} />
  }

  return (
    <ul className="space-y-2">
      {sessionItems.map((s) => {
        const name = dayNameById.get(s.workout_day_id) ?? 'Workout'
        const inProgress = !s.ended_at
        const label = `${name} · ${fmtDate(s.started_at)}`
        return (
          <li
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] cursor-pointer active:bg-white/5"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-xs text-[color:var(--color-muted)]">
                {fmtDate(s.started_at)}
                {s.durationMs != null && <> · {fmtDuration(s.durationMs)}</>}
                {inProgress && <> · in progress</>}
              </div>
            </div>
            <button
              onClick={(e) => onDelete(e, s.id, label)}
              disabled={cancel.isPending}
              className="text-xs text-red-300 underline min-h-[44px] px-2 disabled:opacity-50"
            >
              Delete
            </button>
          </li>
        )
      })}
    </ul>
  )
}
