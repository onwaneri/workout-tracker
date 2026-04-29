import { useView, type ViewKey } from '@/lib/view'

const tabs: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'today', label: 'Today', icon: '●' },
  { key: 'history', label: 'History', icon: '▤' },
  { key: 'plan', label: 'Plan', icon: '▢' },
  { key: 'stats', label: 'Stats', icon: '☰' },
]

export function BottomTabs() {
  const { view, setView } = useView()
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)]/95 backdrop-blur z-20"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = view === t.key
          return (
            <li key={t.key}>
              <button
                onClick={() => setView(t.key)}
                className={`w-full min-h-[56px] flex flex-col items-center justify-center gap-1 text-xs ${
                  active ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-muted)]'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
