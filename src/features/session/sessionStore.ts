import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RestTimer = {
  setId: string
  exerciseId: string
  exerciseName: string
  targetSeconds: number
  startedAt: number
}

type SessionStore = {
  activeSessionId: string | null
  workoutDayId: string | null
  startedAt: number | null
  foregroundMs: number
  backgroundMs: number
  restTimer: RestTimer | null
  setActive: (input: { sessionId: string; workoutDayId: string; startedAt: number }) => void
  addForegroundMs: (ms: number) => void
  addBackgroundMs: (ms: number) => void
  startRest: (timer: RestTimer) => void
  clearRest: () => void
  clear: () => void
}

export const useSession = create<SessionStore>()(
  persist(
    (set) => ({
      activeSessionId: null,
      workoutDayId: null,
      startedAt: null,
      foregroundMs: 0,
      backgroundMs: 0,
      restTimer: null,
      setActive: ({ sessionId, workoutDayId, startedAt }) =>
        set({
          activeSessionId: sessionId,
          workoutDayId,
          startedAt,
          foregroundMs: 0,
          backgroundMs: 0,
          restTimer: null,
        }),
      addForegroundMs: (ms) => set((s) => ({ foregroundMs: s.foregroundMs + ms })),
      addBackgroundMs: (ms) => set((s) => ({ backgroundMs: s.backgroundMs + ms })),
      startRest: (timer) => set({ restTimer: timer }),
      clearRest: () => set({ restTimer: null }),
      clear: () =>
        set({
          activeSessionId: null,
          workoutDayId: null,
          startedAt: null,
          foregroundMs: 0,
          backgroundMs: 0,
          restTimer: null,
        }),
    }),
    { name: 'workout-active-session' },
  ),
)
