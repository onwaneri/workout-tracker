import React from 'react'
import { useView, type ViewKey } from '@/lib/view'

function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c0 4 4 5 4 10a6 6 0 1 1-12 0c0-3 2-4 3-7 1 2 3 2 5 4 .3-3-2-5 0-7Z"/>
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h10"/>
    </svg>
  )
}

function CalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="4" y="6" width="16" height="14" rx="2"/>
      <path d="M4 10h16M9 4v4M15 4v4"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 20h16M6 16l4-5 4 3 5-7"/>
    </svg>
  )
}

function CogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
    </svg>
  )
}

const tabs: { key: ViewKey; label: string; Icon: () => React.ReactElement }[] = [
  { key: 'history',  label: 'Log',     Icon: ListIcon  },
  { key: 'plan',     label: 'Plan',    Icon: CalIcon   },
  { key: 'stats',    label: 'Stats',   Icon: ChartIcon },
  { key: 'settings', label: 'Account', Icon: CogIcon   },
]

export function SideNav() {
  const { view, setView } = useView()
  return (
    <aside
      className="hidden md:flex shrink-0 flex-col"
      style={{
        width: 220,
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        padding: '24px 18px',
        gap: 4,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 8px 24px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--color-accent)', color: 'var(--color-accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FlameIcon />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, letterSpacing: '-0.2px', color: 'var(--color-text)' }}>
            Lift Log
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            v2.0
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1 }}>
        {tabs.map((t) => {
          const active = view === t.key
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 10px',
                border: 'none', borderRadius: 10, cursor: 'pointer',
                textAlign: 'left',
                background: active ? 'var(--color-surface)' : 'transparent',
                color: active ? 'var(--color-text)' : 'var(--color-muted)',
                fontFamily: 'var(--font-body)', fontSize: 13,
                borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                paddingLeft: active ? 8 : 10,
                marginBottom: 2,
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              <t.Icon /><span>{t.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
