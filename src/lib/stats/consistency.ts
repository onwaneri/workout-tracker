import type { Session, WorkoutDay } from '@/lib/supabase/database.types'
import { startOfISOWeek } from '@/lib/format'

// Build a Set of "YYYY-MM-DD" strings for days with at least one completed session.
export function workoutDaysSet(sessions: Session[]): Set<string> {
  const set = new Set<string>()
  for (const s of sessions) {
    if (!s.ended_at) continue
    const d = new Date(s.ended_at)
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return set
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Current day streak: consecutive calendar days (ending today or yesterday) with a workout.
export function currentDayStreak(workoutDays: Set<string>): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start from today; if today has no session, try yesterday as the last active day.
  let cursor = new Date(today)
  if (!workoutDays.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!workoutDays.has(toDateKey(cursor))) return 0
  }

  let streak = 0
  while (workoutDays.has(toDateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
    if (streak > 3650) break // safety cap
  }
  return streak
}

// Longest day streak ever.
export function longestDayStreak(workoutDays: Set<string>): number {
  if (workoutDays.size === 0) return 0

  const sorted = Array.from(workoutDays).sort()
  let longest = 1
  let current = 1

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diffMs = curr.getTime() - prev.getTime()
    if (diffMs === 86400000) {
      current++
      if (current > longest) longest = current
    } else {
      current = 1
    }
  }
  return longest
}

export function plannedSessionsPerWeek(days: WorkoutDay[]): number {
  return days.filter((d) => !d.is_rest).length
}

export function sessionsInWeek(sessions: Session[], weekStart: Date): Session[] {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 7)
  return sessions.filter((s) => {
    const t = new Date(s.started_at).getTime()
    return t >= weekStart.getTime() && t < end.getTime()
  })
}

export function consistencyStreakWeeks(sessions: Session[], plannedPerWeek: number): number {
  if (plannedPerWeek === 0) return 0
  const today = new Date()
  let week = startOfISOWeek(today)
  // Don't count the current week as a "broken" week unless the week ended.
  // Walk backwards while each prior week hits >= plannedPerWeek.
  let streak = 0
  // Skip the in-progress week
  week.setDate(week.getDate() - 7)
  while (true) {
    const inWeek = sessionsInWeek(sessions, week).filter((s) => s.ended_at).length
    if (inWeek >= plannedPerWeek) {
      streak += 1
      week.setDate(week.getDate() - 7)
    } else {
      break
    }
    if (streak > 520) break // safety cap (~10 years)
  }
  return streak
}
