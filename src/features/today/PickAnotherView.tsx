import { useMemo } from 'react'
import { Screen } from '@/components/Screen'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { useAllExercises } from '@/lib/queries/exercises'
import { restTargetSeconds } from '@/features/session/restTargets'
import { fmtDuration } from '@/lib/format'
import type { Exercise, WorkoutDay } from '@/lib/supabase/database.types'

export function PickAnotherView({
  onPick,
  onExit,
  busyDayId,
}: {
  onPick: (day: WorkoutDay) => void
  onExit: () => void
  busyDayId: string | null
}) {
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)
  const allEx = useAllExercises()

  const workoutDays = useMemo(
    () => (days.data ? [...days.data].filter((d) => !d.is_rest).sort((a, b) => a.order_index - b.order_index) : []),
    [days.data],
  )

  const exByDay = useMemo(() => {
    const m = new Map<string, Exercise[]>()
    for (const e of allEx.data ?? []) {
      const list = m.get(e.workout_day_id) ?? []
      list.push(e)
      m.set(e.workout_day_id, list)
    }
    for (const list of m.values()) list.sort((a, b) => a.order_index - b.order_index)
    return m
  }, [allEx.data])

  return (
    <Screen
      title="Log another workout"
      action={
        <button onClick={onExit} className="text-sm text-[color:var(--color-muted)] underline">
          Done
        </button>
      }
    >
      <p className="text-sm text-[color:var(--color-muted)] mb-4">
        Pick a workout to start now. Your cycle will continue from whichever day you choose.
      </p>
      <ul className="space-y-3">
        {workoutDays.map((d) => {
          const exs = exByDay.get(d.id) ?? []
          const estimatedMs = exs.reduce(
            (acc, e) => acc + e.default_sets * restTargetSeconds(e.type) * 1000,
            0,
          )
          const busy = busyDayId === d.id
          return (
            <li key={d.id}>
              <button
                onClick={() => onPick(d)}
                disabled={busyDayId !== null}
                className="w-full text-left rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 hover:bg-white/5 disabled:opacity-50 min-h-[88px]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-lg font-semibold">{d.name}</div>
                  <div className="text-xs text-[color:var(--color-muted)] shrink-0">
                    ~{fmtDuration(estimatedMs)} · {exs.length} ex
                  </div>
                </div>
                {exs.length > 0 && (
                  <div className="mt-2 text-xs text-[color:var(--color-muted)] line-clamp-2">
                    {exs.map((e) => e.name).join(' · ')}
                  </div>
                )}
                {busy && (
                  <div className="mt-2 text-xs text-[color:var(--color-accent)]">Starting…</div>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}
