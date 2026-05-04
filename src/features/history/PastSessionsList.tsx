import { useMemo } from 'react'
import { useSessions, useCancelSession } from '@/lib/queries/sessions'
import { useAllWorkoutDays } from '@/lib/queries/plans'
import { fmtDate, fmtDuration } from '@/lib/format'

export function PastSessionsList() {
  const sessions = useSessions()
  const days = useAllWorkoutDays()
  const cancel = useCancelSession()

  const dayNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of days.data ?? []) m.set(d.id, d.name)
    return m
  }, [days.data])

  if (sessions.isLoading) {
    return <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>
  }

  const items = sessions.data ?? []
  if (items.length === 0) {
    return <p className="text-sm text-[color:var(--color-muted)]">No sessions yet.</p>
  }

  const onDelete = (id: string, label: string) => {
    if (!window.confirm(`Delete ${label}? All sets from this session will be removed.`)) return
    cancel.mutate({ id })
  }

  return (
    <ul className="space-y-2">
      {items.map((s) => {
        const name = dayNameById.get(s.workout_day_id) ?? 'Workout'
        const durationMs =
          s.ended_at && s.started_at ? new Date(s.ended_at).getTime() - new Date(s.started_at).getTime() : null
        const inProgress = !s.ended_at
        const label = `${name} · ${fmtDate(s.started_at)}`
        return (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-xs text-[color:var(--color-muted)]">
                {fmtDate(s.started_at)}
                {durationMs != null && <> · {fmtDuration(durationMs)}</>}
                {inProgress && <> · in progress</>}
              </div>
            </div>
            <button
              onClick={() => onDelete(s.id, label)}
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
