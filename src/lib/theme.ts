import { useCallback, useSyncExternalStore } from 'react'

export type PaletteKey = 'lime' | 'amber' | 'magenta' | 'cyan' | 'paper'

export const PALETTES: { key: PaletteKey; name: string; accent: string; light?: boolean }[] = [
  { key: 'lime',    name: 'Lime',    accent: '#dffe60' },
  { key: 'amber',   name: 'Amber',   accent: '#ffb444' },
  { key: 'magenta', name: 'Magenta', accent: '#ff5fb0' },
  { key: 'cyan',    name: 'Cyan',    accent: '#79e8ff' },
  { key: 'paper',   name: 'Paper',   accent: '#1a1814', light: true },
]

const STORAGE_KEY = 'wt-palette'

function getStored(): PaletteKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && PALETTES.some((p) => p.key === v)) return v as PaletteKey
  } catch { /* ignore */ }
  return 'lime'
}

export function applyPalette(key: PaletteKey) {
  document.documentElement.setAttribute('data-palette', key)
  localStorage.setItem(STORAGE_KEY, key)
  // Update theme-color meta so the browser chrome matches
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', key === 'paper' ? '#f6f3ed' : '#0d0c0a')
  }
}

export function initTheme() {
  applyPalette(getStored())
}

// ── useTheme hook ────────────────────────────────────────────────────────────
// Syncs with localStorage so every component using this hook stays in sync.

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function notifyListeners() {
  listeners.forEach((cb) => cb())
}

export function usePalette(): [PaletteKey, (key: PaletteKey) => void] {
  const palette = useSyncExternalStore(subscribe, getStored, () => 'lime' as PaletteKey)

  const setPalette = useCallback((key: PaletteKey) => {
    applyPalette(key)
    notifyListeners()
  }, [])

  return [palette, setPalette]
}
