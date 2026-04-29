import { useEffect, useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { useAllExercises } from '@/lib/queries/exercises'
import { buildEditedPlanFromDb, snapshotPlan, type EditedDay, type EditedPlan } from './snapshotPlan'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queries/keys'
import { supabase } from '@/lib/supabase/client'
import type { SupersetGroup } from '@/lib/supabase/database.types'
import { DayEditor } from './DayEditor'

export function PlanEditorView() {
  const qc = useQueryClient()
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)
  const allExercises = useAllExercises()

  const dayIds = days.data?.map((d) => d.id) ?? []
  const supersetQueries = useQueries({
    queries: dayIds.map((id) => ({
      queryKey: qk.supersets(id),
      queryFn: async (): Promise<SupersetGroup[]> => {
        const { data, error } = await supabase.from('superset_groups').select('*').eq('workout_day_id', id)
        if (error) throw error
        return data ?? []
      },
    })),
  })

  const allLoaded =
    !!pv.data && !!days.data && !!allExercises.data && supersetQueries.every((q) => q.isSuccess || q.isError)

  const [draft, setDraft] = useState<EditedPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const { exercisesByDay, supersetsByDay } = useMemo(() => {
    const exMap = new Map<string, typeof allExercises.data extends infer T ? T extends readonly (infer U)[] ? U[] : never : never>()
    const ssMap = new Map<string, SupersetGroup[]>()
    if (allExercises.data && days.data) {
      const dayIdSet = new Set(days.data.map((d) => d.id))
      for (const e of allExercises.data) {
        if (!dayIdSet.has(e.workout_day_id)) continue
        const list = exMap.get(e.workout_day_id) ?? []
        list.push(e)
        exMap.set(e.workout_day_id, list)
      }
      days.data.forEach((d, i) => {
        const r = supersetQueries[i]
        if (r.data) ssMap.set(d.id, r.data)
      })
    }
    return { exercisesByDay: exMap, supersetsByDay: ssMap }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allExercises.data, days.data, ...supersetQueries.map((q) => q.data)])

  useEffect(() => {
    if (allLoaded && pv.data && days.data && !draft) {
      setDraft(
        buildEditedPlanFromDb(
          pv.data.plan_id,
          pv.data.id,
          pv.data.version_number,
          days.data,
          exercisesByDay as Map<string, never[]>,
          supersetsByDay,
        ),
      )
    }
  }, [allLoaded, pv.data, days.data, draft, exercisesByDay, supersetsByDay])

  if (pv.isLoading || days.isLoading || allExercises.isLoading || !draft) {
    return (
      <Screen title="Plan">
        <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>
      </Screen>
    )
  }

  const updateDay = (idx: number, next: EditedDay) => {
    setDraft((d) => (d ? { ...d, days: d.days.map((x, i) => (i === idx ? next : x)) } : d))
  }

  const moveDay = (from: number, to: number) => {
    setDraft((d) => {
      if (!d) return d
      if (to < 0 || to >= d.days.length) return d
      const next = d.days.slice()
      const [m] = next.splice(from, 1)
      next.splice(to, 0, m)
      return { ...d, days: next }
    })
  }

  const onSave = async () => {
    if (!draft) return
    setSaving(true)
    setSavedMsg(null)
    try {
      await snapshotPlan(draft)
      await qc.invalidateQueries()
      setSavedMsg('Saved as new plan version.')
      setDraft(null)
    } catch (e) {
      setSavedMsg(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen
      title="Plan"
      action={
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      {savedMsg && (
        <div className="mb-4 text-sm rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
          {savedMsg}
        </div>
      )}
      <ul className="space-y-3">
        {draft.days.map((d, i) => (
          <li key={i}>
            <DayEditor
              day={d}
              dayNumber={i + 1}
              onChange={(next) => updateDay(i, next)}
              onMoveUp={() => moveDay(i, i - 1)}
              onMoveDown={() => moveDay(i, i + 1)}
            />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-[color:var(--color-muted)]">
        Saving creates a new plan version. In-progress sessions stay on the previous version.
      </p>
    </Screen>
  )
}
