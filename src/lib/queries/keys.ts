import { getClientUuid } from '@/lib/supabase/uuid'

// Evaluate once at module load to avoid repeated function calls and ensure stable reference.
// Client UUID is stored in localStorage and never changes within a session.
const CLIENT_UUID = getClientUuid()

export const qk = {
  plans: () => ['plans', CLIENT_UUID] as const,
  activePlanVersion: () => ['plan-version', 'active', CLIENT_UUID] as const,
  workoutDays: (planVersionId: string) => ['workout-days', CLIENT_UUID, planVersionId] as const,
  workoutDaysAll: () => ['workout-days', 'all', CLIENT_UUID] as const,
  exercises: (workoutDayId: string) => ['exercises', CLIENT_UUID, workoutDayId] as const,
  exercisesAll: () => ['exercises', 'all', CLIENT_UUID] as const,
  sessions: () => ['sessions', CLIENT_UUID] as const,
  session: (id: string) => ['session', CLIENT_UUID, id] as const,
  sessionSets: (sessionId: string) => ['session-sets', CLIENT_UUID, sessionId] as const,
  exerciseHistory: (exerciseId: string) => ['exercise-history', CLIENT_UUID, exerciseId] as const,
  lastSets: () => ['last-sets', CLIENT_UUID] as const,
  lastSetsFor: (joined: string) => ['last-sets', CLIENT_UUID, joined] as const,
  goals: () => ['goals', CLIENT_UUID] as const,
  sessionSwaps: (sessionId: string) => ['session-swaps', CLIENT_UUID, sessionId] as const,
}
