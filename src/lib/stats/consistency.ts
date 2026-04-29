import type { Session, WorkoutDay } from '@/lib/supabase/database.types'
import { startOfISOWeek } from '@/lib/format'

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
  week = new Date(week)
  week.setDate(week.getDate() - 7)
  while (true) {
    const inWeek = sessionsInWeek(sessions, week).filter((s) => s.ended_at).length
    if (inWeek >= plannedPerWeek) {
      streak += 1
      week = new Date(week)
      week.setDate(week.getDate() - 7)
    } else {
      break
    }
    if (streak > 520) break // safety cap (~10 years)
  }
  return streak
}
