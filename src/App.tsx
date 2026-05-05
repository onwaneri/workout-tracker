import { useEffect, useSyncExternalStore } from 'react'
import { useView } from '@/lib/view'
import { BottomTabs } from '@/components/BottomTabs'
import { SideNav } from '@/components/SideNav'
import { TodayView } from '@/features/today/TodayView'
import { HistoryView } from '@/features/history/HistoryView'
import { PlanEditorView } from '@/features/plan-editor/PlanEditorView'
import { StatsView } from '@/features/stats/StatsView'
import { SettingsView } from '@/features/settings/SettingsView'

const DESKTOP_QUERY = '(min-width: 768px)'

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(DESKTOP_QUERY)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  )
}

function CurrentView() {
  const view = useView((s) => s.view)
  const setView = useView((s) => s.setView)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (isDesktop && view === 'today') setView('history')
  }, [isDesktop, view, setView])

  if (isDesktop && view === 'today') return null

  switch (view) {
    case 'today':
      return <TodayView />
    case 'history':
      return <HistoryView />
    case 'plan':
      return <PlanEditorView />
    case 'stats':
      return <StatsView />
    case 'settings':
      return <SettingsView />
  }
}

export default function App() {
  return (
    <div className="md:flex min-h-[100svh]">
      <SideNav />
      <main className="flex flex-col flex-1 min-h-[100svh]">
        <CurrentView />
      </main>
      <BottomTabs />
    </div>
  )
}
