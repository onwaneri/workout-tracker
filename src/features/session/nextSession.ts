import type { Session, WorkoutDay } from '@/lib/supabase/database.types'

// Rolling-position next session: based on last completed (or in-progress) session,
// advance through plan_version's day order, skipping rest days.
export function pickNextWorkoutDay(days: WorkoutDay[], sessions: Session[]): WorkoutDay | null {
  if (days.length === 0) return null
  const sorted = [...days].sort((a, b) => a.order_index - b.order_index)
  const workoutDays = sorted.filter((d) => !d.is_rest)
  if (workoutDays.length === 0) return null

  const lastSession = sessions[0] // sessions are returned ordered DESC by started_at
  if (!lastSession) return workoutDays[0]

  const lastIdx = sorted.findIndex((d) => d.id === lastSession.workout_day_id)
  if (lastIdx === -1) return workoutDays[0]

  for (let step = 1; step <= sorted.length; step++) {
    const next = sorted[(lastIdx + step) % sorted.length]
    if (!next.is_rest) return next
  }
  return workoutDays[0]
}
