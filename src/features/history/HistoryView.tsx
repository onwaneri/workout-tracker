import { useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { fmtDate, fmtWeight } from '@/lib/format'
import { ExerciseChart } from './ExerciseChart'

type HistoryGroup = { id: string; name: string; ids: string[] }

export function HistoryView() {
  const allEx = useAllExercises()
  const [selectedGroup, setSelectedGroup] = useState<HistoryGroup | null>(null)

  const latestByLogicalName = useMemo(() => {
    if (!allEx.data) return []

    const groupsByRoot = new Map<
      string,
      { id: string; name: string; ids: Set<string>; latestCreatedAt: string }
    >()

    for (const e of allEx.data) {
      const lineage = resolveExerciseLineage(e.id, allEx.data)
      const root = lineage[lineage.length - 1] ?? e.id
      const existing = groupsByRoot.get(root)
      if (!existing) {
        groupsByRoot.set(root, {
          id: e.id,
          name: e.name,
          ids: new Set(lineage),
          latestCreatedAt: e.created_at,
        })
      } else {
        for (const id of lineage) existing.ids.add(id)
        if (e.created_at > existing.latestCreatedAt) {
          existing.id = e.id
          existing.name = e.name
          existing.latestCreatedAt = e.created_at
        }
      }
    }

    const groupsByName = new Map<
      string,
      { id: string; name: string; ids: Set<string>; latestCreatedAt: string }
    >()

    for (const group of groupsByRoot.values()) {
      const key = group.name.trim().toLowerCase()
      const existing = groupsByName.get(key)
      if (!existing) {
        groupsByName.set(key, {
          id: group.id,
          name: group.name,
          ids: new Set(group.ids),
          latestCreatedAt: group.latestCreatedAt,
        })
      } else {
        for (const id of group.ids) existing.ids.add(id)
        if (group.latestCreatedAt > existing.latestCreatedAt) {
          existing.id = group.id
          existing.name = group.name
          existing.latestCreatedAt = group.latestCreatedAt
        }
      }
    }

    return Array.from(groupsByName.values())
      .map((group) => ({ id: group.id, name: group.name, ids: Array.from(group.ids).sort() }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allEx.data])

  const hist = useExerciseHistory(selectedGroup?.ids ?? [])

  if (selectedGroup) {
    return (
      <Screen
        title="History"
        action={
          <button
            onClick={() => setSelectedGroup(null)}
            className="text-sm text-[color:var(--color-muted)] underline"
          >
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
                onClick={() => setSelectedGroup(e)}
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
