import { useView } from '@/lib/view'
import { BottomTabs } from '@/components/BottomTabs'
import { SideNav } from '@/components/SideNav'
import { TodayView } from '@/features/today/TodayView'
import { HistoryView } from '@/features/history/HistoryView'
import { PlanEditorView } from '@/features/plan-editor/PlanEditorView'
import { StatsView } from '@/features/stats/StatsView'

function CurrentView() {
  const view = useView((s) => s.view)
  switch (view) {
    case 'today':
      return <TodayView />
    case 'history':
      return <HistoryView />
    case 'plan':
      return <PlanEditorView />
    case 'stats':
      return <StatsView />
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
