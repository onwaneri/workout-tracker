import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TargetOverride } from '@/lib/stats/targets'

function normalizeKey(name: string): string {
  return name.trim().toLowerCase()
}

type TargetOverrideStore = {
  overrides: Record<string, TargetOverride>
  setOverride: (name: string, target: Omit<TargetOverride, 'createdAt'>) => void
  clearOverride: (name: string) => void
  clearAll: () => void
}

export const useTargetOverrides = create<TargetOverrideStore>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (name, target) =>
        set((s) => ({
          overrides: {
            ...s.overrides,
            [normalizeKey(name)]: { ...target, createdAt: Date.now() },
          },
        })),
      clearOverride: (name) =>
        set((s) => {
          const next = { ...s.overrides }
          delete next[normalizeKey(name)]
          return { overrides: next }
        }),
      clearAll: () => set({ overrides: {} }),
    }),
    { name: 'workout-target-overrides' },
  ),
)
