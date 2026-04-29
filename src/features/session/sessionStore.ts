import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SessionStore = {
  activeSessionId: string | null
  workoutDayId: string | null
  startedAt: number | null
  foregroundMs: number
  backgroundMs: number
  setActive: (input: { sessionId: string; workoutDayId: string; startedAt: number }) => void
  addForegroundMs: (ms: number) => void
  addBackgroundMs: (ms: number) => void
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
      setActive: ({ sessionId, workoutDayId, startedAt }) =>
        set({
          activeSessionId: sessionId,
          workoutDayId,
          startedAt,
          foregroundMs: 0,
          backgroundMs: 0,
        }),
      addForegroundMs: (ms) => set((s) => ({ foregroundMs: s.foregroundMs + ms })),
      addBackgroundMs: (ms) => set((s) => ({ backgroundMs: s.backgroundMs + ms })),
      clear: () =>
        set({ activeSessionId: null, workoutDayId: null, startedAt: null, foregroundMs: 0, backgroundMs: 0 }),
    }),
    { name: 'workout-active-session' },
  ),
)
