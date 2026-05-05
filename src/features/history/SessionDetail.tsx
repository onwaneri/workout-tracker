import { useMemo } from 'react'
import { useSession, useSessionSets } from '@/lib/queries/sessions'
import { useExercises } from '@/lib/queries/exercises'
import { useSessionSwaps } from '@/lib/queries/swaps'
import { fmtDate, fmtDuration, fmtWeight } from '@/lib/format'
import { totalVolume, setVolume } from '@/lib/stats/volume'
import type { SessionSet } from '@/lib/supabase/database.types'

export function SessionDetail({
  sessionId,
  dayName,
  onBack,
}: {
  sessionId: string
  dayName: string
  onBack: () => void
}) {
  const sess = useSession(sessionId)
  const sets = useSessionSets(sessionId)
  const dayExercises = useExercises(sess.data?.workout_day_id)
  const swaps = useSessionSwaps(sessionId)

  const exerciseGroups = useMemo(() => {
    if (!sets.data || !dayExercises.data) return []

    const swapMap = new Map<string, string>()
    for (const s of swaps.data ?? []) {
      swapMap.set(s.planned_exercise_id, s.performed_exercise_name)
    }

    const exById = new Map(dayExercises.data.map((e) => [e.id, e] as const))
    const grouped = new Map<string, { name: string; sets: SessionSet[] }>()

    for (const s of sets.data) {
      const existing = grouped.get(s.exercise_id)
      if (existing) {
        existing.sets.push(s)
      } else {
        const ex = exById.get(s.exercise_id)
        const swappedName = swapMap.get(s.exercise_id)
        grouped.set(s.exercise_id, {
          name: swappedName ?? ex?.name ?? 'Unknown exercise',
          sets: [s],
        })
      }
    }

    return Array.from(grouped.values())
  }, [sets.data, dayExercises.data, swaps.data])

  // Memoize computed session stats to avoid recalculating on every render
  const sessionStats = useMemo(() => {
    if (!sess.data || !sets.data) return null

    const durationMs =
      sess.data.ended_at && sess.data.started_at
        ? new Date(sess.data.ended_at).getTime() - new Date(sess.data.started_at).getTime()
        : null
    const workingSets = sets.data.filter((s) => !s.is_warmup && !s.is_skipped)
    const volume = totalVolume(sets.data)

    return { durationMs, workingSets, volume }
  }, [sess.data, sets.data])

  if (!sess.data || !sets.data || !dayExercises.data || !sessionStats) {
    return <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-[color:var(--color-muted)] underline mb-4 min-h-[44px]">
        &larr; All sessions
      </button>

      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 mb-4">
        <div className="text-lg font-semibold">{dayName}</div>
        <div className="text-xs text-[color:var(--color-muted)] mt-1">
          {fmtDate(sess.data.started_at)}
          {sessionStats.durationMs != null && <> · {fmtDuration(sessionStats.durationMs)}</>}
          {' · '}{sessionStats.workingSets.length} sets
          {sessionStats.volume > 0 && <> · {Math.round(sessionStats.volume).toLocaleString()} lb</>}
        </div>
      </div>

      {exerciseGroups.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted)]">No sets logged.</p>
      ) : (
        <div className="space-y-4">
          {exerciseGroups.map((group) => {
            const working = group.sets.filter((s) => !s.is_warmup && !s.is_skipped)
            const exVol = working.reduce((acc, s) => acc + setVolume(s), 0)
            return (
              <div
                key={group.sets[0].exercise_id}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-sm font-medium">{group.name}</div>
                  {exVol > 0 && (
                    <div className="text-xs text-[color:var(--color-muted)]">
                      {Math.round(exVol).toLocaleString()} lb
                    </div>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">
                    <tr>
                      <th className="text-left py-1">Set</th>
                      <th className="text-right py-1">Weight</th>
                      <th className="text-right py-1">Reps</th>
                      <th className="text-right py-1">RPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sets.map((s, i) => (
                      <tr
                        key={s.id}
                        className={`border-t border-[color:var(--color-border)] ${s.is_skipped ? 'opacity-40' : ''}`}
                      >
                        <td className="py-1.5">
                          {s.is_warmup ? (
                            <span className="text-xs text-[color:var(--color-muted)]">W</span>
                          ) : s.is_skipped ? (
                            <span className="text-xs text-[color:var(--color-muted)]">skip</span>
                          ) : (
                            i + 1
                          )}
                        </td>
                        <td className="text-right py-1.5">{fmtWeight(s.weight)}</td>
                        <td className="text-right py-1.5">{s.reps ?? '—'}</td>
                        <td className="text-right py-1.5 text-[color:var(--color-muted)]">{s.rpe ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
