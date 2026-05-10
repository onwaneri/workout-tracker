import React from 'react'
import { useView, type ViewKey } from '@/lib/view'

function FlameIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c0 4 4 5 4 10a6 6 0 1 1-12 0c0-3 2-4 3-7 1 2 3 2 5 4 .3-3-2-5 0-7Z"/>
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h10"/>
    </svg>
  )
}

function CalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="4" y="6" width="16" height="14" rx="2"/>
      <path d="M4 10h16M9 4v4M15 4v4"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 20h16M6 16l4-5 4 3 5-7"/>
    </svg>
  )
}

function CogIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
    </svg>
  )
}

const tabs: { key: ViewKey; label: string; Icon: () => React.ReactElement }[] = [
  { key: 'today',    label: 'Today',   Icon: FlameIcon },
  { key: 'history',  label: 'Log',     Icon: ListIcon  },
  { key: 'plan',     label: 'Plan',    Icon: CalIcon   },
  { key: 'stats',    label: 'Stats',   Icon: ChartIcon },
  { key: 'settings', label: 'You',     Icon: CogIcon   },
]

export function BottomTabs() {
  const { view, setView } = useView()
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-20"
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = view === t.key
          return (
            <li key={t.key}>
              <button
                onClick={() => setView(t.key)}
                className="w-full flex flex-col items-center justify-center gap-1 py-2"
                style={{
                  color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  minHeight: 56,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                aria-current={active ? 'page' : undefined}
              >
                <t.Icon />
                <span>{t.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
