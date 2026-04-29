import { useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { fmtDate, fmtWeight } from '@/lib/format'
import { ExerciseChart } from './ExerciseChart'

export function HistoryView() {
  const allEx = useAllExercises()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const latestByLogicalName = useMemo(() => {
    if (!allEx.data) return []
    // Show one row per "logical exercise" — most recent in each lineage chain.
    const byLineageHead = new Map<string, { id: string; name: string; lineage: string[] }>()
    for (const e of allEx.data) {
      const lineage = resolveExerciseLineage(e.id, allEx.data)
      const root = lineage[lineage.length - 1] ?? e.id
      const existing = byLineageHead.get(root)
      if (!existing) {
        byLineageHead.set(root, { id: e.id, name: e.name, lineage })
      } else {
        // Keep whichever is newer (later created_at, found via id lookup)
        const a = allEx.data.find((x) => x.id === existing.id)
        const b = e
        if (a && b && b.created_at > a.created_at) {
          byLineageHead.set(root, { id: e.id, name: e.name, lineage })
        }
      }
    }
    return Array.from(byLineageHead.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allEx.data])

  const selectedLineage = useMemo(() => {
    if (!selectedId || !allEx.data) return []
    return resolveExerciseLineage(selectedId, allEx.data)
  }, [selectedId, allEx.data])

  const hist = useExerciseHistory(selectedLineage)

  if (selectedId) {
    return (
      <Screen
        title="History"
        action={
          <button onClick={() => setSelectedId(null)} className="text-sm text-[color:var(--color-muted)] underline">
            Back
          </button>
        }
      >
        <div className="hidden md:block mb-4">
          <ExerciseChart sets={hist.data ?? []} />
        </div>
        {hist.data && hist.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr>
                <th className="text-left py-2">Date</th>
                <th className="text-right">Weight</th>
                <th className="text-right">Reps</th>
                <th className="text-right">RPE</th>
              </tr>
            </thead>
            <tbody>
              {hist.data.map((s) => (
                <tr key={s.id} className="border-t border-[color:var(--color-border)]">
                  <td className="py-2">{fmtDate(s.logged_at)}</td>
                  <td className="text-right">{fmtWeight(s.weight)}</td>
                  <td className="text-right">{s.reps ?? '—'}</td>
                  <td className="text-right text-[color:var(--color-muted)]">{s.rpe ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[color:var(--color-muted)]">No sets logged yet.</p>
        )}
      </Screen>
    )
  }

  return (
    <Screen title="History">
      {latestByLogicalName.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted)]">No exercises yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {latestByLogicalName.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setSelectedId(e.id)}
                className="w-full text-left px-3 py-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-white/5 min-h-[52px]"
              >
                {e.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
