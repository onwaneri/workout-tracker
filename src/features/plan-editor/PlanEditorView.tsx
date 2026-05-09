import { useEffect, useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useActivePlanVersion, useWorkoutDays, usePlans, useSwitchActivePlan } from '@/lib/queries/plans'
import { useAllExercises } from '@/lib/queries/exercises'
import { buildEditedPlanFromDb, snapshotPlan, type EditedDay, type EditedPlan } from './snapshotPlan'
import { useQueryClient } from '@tanstack/react-query'
import { DayEditor } from './DayEditor'
import { isAiFeaturesEnabled } from '@/lib/ai/featureFlag'
import { AiPlanChat } from './AiPlanChat'
import { applyAiDiff } from './applyAiDiff'
import type { PlanEditAction } from '@/lib/ai/schemas'
import { useView } from '@/lib/view'

const MIN_DAYS = 3
const MAX_DAYS = 10

export function PlanEditorView() {
  const qc = useQueryClient()
  const plans = usePlans()
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)
  const allExercises = useAllExercises()
  const switchPlan = useSwitchActivePlan()
  const setView = useView((s) => s.setView)

  const allLoaded = !!pv.data && !!days.data && !!allExercises.data

  const [draft, setDraft] = useState<EditedPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  type Exercise = NonNullable<typeof allExercises.data>[number]
  const exercisesByDay = useMemo(() => {
    const exMap = new Map<string, Exercise[]>()
    if (allExercises.data && days.data) {
      const dayIdSet = new Set(days.data.map((d) => d.id))
      for (const e of allExercises.data) {
        if (!dayIdSet.has(e.workout_day_id)) continue
        const list = exMap.get(e.workout_day_id) ?? []
        list.push(e)
        exMap.set(e.workout_day_id, list)
      }
    }
    return exMap
  }, [allExercises.data, days.data])

  useEffect(() => {
    if (allLoaded && pv.data && days.data && !draft) {
      setDraft(
        buildEditedPlanFromDb(
          pv.data.plan_id,
          pv.data.id,
          pv.data.version_number,
          days.data,
          exercisesByDay as Map<string, never[]>,
        ),
      )
    }
  }, [allLoaded, pv.data, days.data, draft, exercisesByDay])

  if (pv.isLoading || days.isLoading || allExercises.isLoading || !draft) {
    return (
      <Screen title="Plan">
        <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>
      </Screen>
    )
  }

  const activePlanId = pv.data?.plan_id ?? null

  const handleSwitchPlan = async (planId: string) => {
    if (planId === activePlanId) return
    if (draft && !window.confirm('Switch plans? Unsaved changes will be lost.')) return
    setDraft(null)
    setSavedMsg(null)
    await switchPlan.mutateAsync(planId)
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

  const addDay = () => {
    setDraft((d) => {
      if (!d || d.days.length >= MAX_DAYS) return d
      const n = d.days.length + 1
      return { ...d, days: [...d.days, { name: `Day ${n}`, is_rest: false, exercises: [] }] }
    })
  }

  const removeDay = (idx: number) => {
    setDraft((d) => {
      if (!d || d.days.length <= MIN_DAYS) return d
      return { ...d, days: d.days.filter((_, i) => i !== idx) }
    })
  }

  const onSave = async () => {
    if (!draft) return
    setSaving(true)
    setSavedMsg(null)
    try {
      await snapshotPlan(draft)
      await qc.invalidateQueries({ queryKey: ['plans'] })
      await qc.invalidateQueries({ queryKey: ['plan-version'] })
      await qc.invalidateQueries({ queryKey: ['workout-days'] })
      await qc.invalidateQueries({ queryKey: ['exercises'] })
      setSavedMsg('Saved as new plan version.')
      setDraft(null)
    } catch (e) {
      setSavedMsg(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const busy = switchPlan.isPending

  return (
    <Screen
      title="Plan"
      action={
        <Button variant="primary" onClick={onSave} disabled={saving || busy}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      {/* Plan switcher */}
      <div className="-mx-4 px-4 mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(plans.data ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => handleSwitchPlan(p.id)}
              disabled={busy}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                p.id === activePlanId
                  ? 'bg-[color:var(--color-accent)] border-[color:var(--color-accent)] text-white'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)]'
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => setView('create-plan')}
            className="shrink-0 px-3 py-1.5 rounded-full text-sm border border-dashed border-[color:var(--color-border)] text-[color:var(--color-muted)]"
          >
            + New
          </button>
        </div>
      </div>

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
              onRemove={draft.days.length > MIN_DAYS ? () => removeDay(i) : undefined}
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={addDay}
          disabled={draft.days.length >= MAX_DAYS}
        >
          + Add day
        </Button>
        <span className="text-xs text-[color:var(--color-muted)]">
          {draft.days.length}/{MAX_DAYS} days
        </span>
      </div>

      <p className="mt-6 text-xs text-[color:var(--color-muted)]">
        Saving creates a new plan version and makes this plan active. In-progress sessions stay on the previous version.
      </p>

      {isAiFeaturesEnabled() && (
        <AiPlanChat
          draft={draft}
          onApplyDiff={useCallback((actions: PlanEditAction[]) => {
            try {
              const updated = applyAiDiff(draft, actions)
              setDraft(updated)
            } catch {
              // If diff application fails, don't crash — user can still edit manually
            }
          }, [draft])}
        />
      )}
    </Screen>
  )
}
