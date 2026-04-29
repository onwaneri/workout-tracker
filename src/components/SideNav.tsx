import { useView, type ViewKey } from '@/lib/view'

const tabs: { key: ViewKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'history', label: 'History' },
  { key: 'plan', label: 'Plan' },
  { key: 'stats', label: 'Stats' },
]

export function SideNav() {
  const { view, setView } = useView()
  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 shrink-0 flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <div className="px-6 pt-7 pb-5">
        <div className="text-lg font-semibold tracking-tight">Workout Tracker</div>
        <div className="text-xs text-[color:var(--color-muted)] mt-0.5">Upper / Lower</div>
      </div>
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {tabs.map((t) => {
            const active = view === t.key
            return (
              <li key={t.key}>
                <button
                  onClick={() => setView(t.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                    active
                      ? 'bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]'
                      : 'text-[color:var(--color-text)] hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
