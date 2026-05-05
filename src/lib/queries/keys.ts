import { getClientUuid } from '@/lib/supabase/uuid'

const c = () => getClientUuid()

export const qk = {
  plans: () => ['plans', c()] as const,
  activePlanVersion: () => ['plan-version', 'active', c()] as const,
  workoutDays: (planVersionId: string) => ['workout-days', c(), planVersionId] as const,
  workoutDaysAll: () => ['workout-days', 'all', c()] as const,
  exercises: (workoutDayId: string) => ['exercises', c(), workoutDayId] as const,
  exercisesAll: () => ['exercises', 'all', c()] as const,
  sessions: () => ['sessions', c()] as const,
  session: (id: string) => ['session', c(), id] as const,
  sessionSets: (sessionId: string) => ['session-sets', c(), sessionId] as const,
  exerciseHistory: (exerciseId: string) => ['exercise-history', c(), exerciseId] as const,
  lastSets: () => ['last-sets', c()] as const,
  lastSetsFor: (joined: string) => ['last-sets', c(), joined] as const,
  goals: () => ['goals', c()] as const,
  sessionSwaps: (sessionId: string) => ['session-swaps', c(), sessionId] as const,
}
