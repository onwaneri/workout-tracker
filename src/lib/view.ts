import { create } from 'zustand'

export type ViewKey = 'today' | 'history' | 'plan' | 'stats'

type ViewStore = {
  view: ViewKey
  setView: (v: ViewKey) => void
}

export const useView = create<ViewStore>((set) => ({
  view: 'today',
  setView: (view) => set({ view }),
}))
