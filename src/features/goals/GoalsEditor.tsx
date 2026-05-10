import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { useGoals, useUpsertExerciseGoal, useBulkUpsertGoals } from '@/lib/queries/goals'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { isAiFeaturesEnabled } from '@/lib/ai/featureFlag'
import { requestGoalSuggestions } from '@/lib/ai/client'
import type { GoalSuggestionsPayload } from '@/lib/ai/client'
import { fmtWeight } from '@/lib/format'

const SMALLEST_PLATE_LB = 2.5
const RECENT_SETS_LIMIT = 5

type ExerciseHead = { id: string; name: string; muscle_group: string; type: string }

export function GoalsEditor() {
  const allEx = useAllExercises()
  const goals = useGoals()
  const upsertExGoal = useUpsertExerciseGoal()
  const bulkUpsert = useBulkUpsertGoals()
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const aiTriggeredRef = useRef(false)

  const activeDayIds = useMemo(
    () => new Set((days.data ?? []).map((d) => d.id)),
    [days.data],
  )

  const exerciseHeads = useMemo(() => {
    if (!allEx.data) return [] as ExerciseHead[]
    const seen = new Map<string, ExerciseHead>()
    for (const e of allEx.data) {
      if (!activeDayIds.has(e.workout_day_id)) continue
      const current = seen.get(e.name)
      if (!current || (allEx.data.find((x) => x.id === current.id)?.created_at ?? '') < e.created_at) {
        seen.set(e.name, { id: e.id, name: e.name, muscle_group: e.muscle_group, type: e.type })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allEx.data, activeDayIds])

  // Collect all exercise IDs for a single history fetch
  const allLineageIds = useMemo(() => {
    if (!allEx.data || exerciseHeads.length === 0) return [] as string[]
    const ids: string[] = []
    for (const head of exerciseHeads) {
      ids.push(...resolveExerciseLineage(head.id, allEx.data))
    }
    return [...new Set(ids)]
  }, [allEx.data, exerciseHeads])

  const allHistory = useExerciseHistory(allLineageIds)

  // Build per-exercise recent sets map for AI
  const recentSetsMap = useMemo(() => {
    if (!allHistory.data || !allEx.data) return new Map<string, GoalSuggestionsPayload['exercises'][number]['recentSets']>()
    const map = new Map<string, GoalSuggestionsPayload['exercises'][number]['recentSets']>()
    for (const head of exerciseHeads) {
      const lineage = new Set(resolveExerciseLineage(head.id, allEx.data))
      const sets = allHistory.data
        .filter((s) => lineage.has(s.exercise_id) && !s.is_warmup && !s.is_skipped)
        .slice(0, RECENT_SETS_LIMIT)
        .map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, logged_at: s.logged_at }))
      map.set(head.id, sets)
    }
    return map
  }, [allHistory.data, allEx.data, exerciseHeads])

  const generateGoals = useCallback(
    async (exercises: ExerciseHead[]) => {
      setAiLoading(true)
      setAiError(null)
      try {
        const payload: GoalSuggestionsPayload = {
          exercises: exercises.map((e) => ({
            name: e.name,
            muscle_group: e.muscle_group,
            type: e.type,
            recentSets: recentSetsMap.get(e.id) ?? [],
          })),
        }
        const result = await requestGoalSuggestions(payload)
        const nameToId = new Map(exercises.map((e) => [e.name, e.id]))
        const upserts = result.suggestions
          .filter((s) => nameToId.has(s.exercise_name))
          .map((s) => ({
            exercise_id: nameToId.get(s.exercise_name)!,
            target_weight: s.target_weight,
            target_reps: s.target_reps,
          }))
        if (upserts.length > 0) {
          bulkUpsert.mutate(upserts)
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'AI goal generation failed')
      } finally {
        setAiLoading(false)
      }
    },
    [recentSetsMap, bulkUpsert],
  )

  // Auto-trigger AI for exercises missing goals
  useEffect(() => {
    if (!isAiFeaturesEnabled() || !navigator.onLine) return
    if (!exerciseHeads.length || aiLoading || aiTriggeredRef.current) return
    if (!allHistory.data) return // wait for history to load
    const existingGoalIds = new Set((goals.data ?? []).filter((g) => g.exercise_id).map((g) => g.exercise_id))
    const missing = exerciseHeads.filter((e) => !existingGoalIds.has(e.id))
    if (missing.length === 0) return
    aiTriggeredRef.current = true
    generateGoals(exerciseHeads)
  }, [exerciseHeads, goals.data, allHistory.data, aiLoading, generateGoals])

  // Reset trigger ref when active plan changes
  useEffect(() => {
    aiTriggeredRef.current = false
  }, [pv.data?.id])

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">Per exercise</h3>
          {isAiFeaturesEnabled() && (
            <Button
              variant="secondary"
              onClick={() => generateGoals(exerciseHeads)}
              disabled={aiLoading || exerciseHeads.length === 0}
            >
              {aiLoading ? 'Generating...' : 'Refresh goals'}
            </Button>
          )}
        </div>
        {aiError && (
          <p className="text-xs text-red-400 mb-2">{aiError}</p>
        )}
        {aiLoading && (
          <div className="space-y-2 mb-2">
            {exerciseHeads.map((e) => (
              <div
                key={e.id}
                className="h-12 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] animate-pulse"
              />
            ))}
          </div>
        )}
        {!aiLoading && (
          <ul className="space-y-2">
            {exerciseHeads.map((e) => (
              <ExerciseGoalRow
                key={e.id}
                exerciseId={e.id}
                name={e.name}
                goal={(goals.data ?? []).find((g) => g.exercise_id === e.id) ?? null}
                onSave={(target_weight, target_reps) =>
                  upsertExGoal.mutate({ exercise_id: e.id, target_weight, target_reps })
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ExerciseGoalRow({
  exerciseId,
  name,
  goal,
  onSave,
}: {
  exerciseId: string
  name: string
  goal: { target_weight: number | null; target_reps: number | null } | null
  onSave: (w: number | null, r: number | null) => void
}) {
  const allEx = useAllExercises()
  const lineage = useMemo(
    () => (allEx.data ? resolveExerciseLineage(exerciseId, allEx.data) : []),
    [allEx.data, exerciseId],
  )
  const history = useExerciseHistory(lineage)

  const lastTopSet = useMemo(() => {
    if (!history.data) return null
    const working = history.data.filter((s) => !s.is_warmup && !s.is_skipped && s.weight != null && s.reps != null)
    if (working.length === 0) return null
    // Most recent session: take the highest-weight set from the most recent logged_at date
    const newestDate = working[0].logged_at
    const newestSession = working.filter((s) => s.logged_at === newestDate || s.session_id === working[0].session_id)
    return newestSession.reduce(
      (best, s) => (s.weight! > (best?.weight ?? -Infinity) ? s : best),
      null as null | (typeof working)[number],
    )
  }, [history.data])

  const suggested =
    goal?.target_weight == null && lastTopSet
      ? { weight: (lastTopSet.weight ?? 0) + SMALLEST_PLATE_LB, reps: lastTopSet.reps ?? 0 }
      : null

  const [w, setW] = useState<string>(goal?.target_weight?.toString() ?? '')
  const [r, setR] = useState<string>(goal?.target_reps?.toString() ?? '')

  // Sync local state when goal changes (e.g. from AI bulk upsert)
  useEffect(() => {
    if (goal?.target_weight != null) setW(goal.target_weight.toString())
    if (goal?.target_reps != null) setR(goal.target_reps.toString())
  }, [goal?.target_weight, goal?.target_reps])

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm">{name}</div>
        {lastTopSet && (
          <div className="text-[10px] text-[color:var(--color-muted)]">
            Last: {fmtWeight(lastTopSet.weight)} × {lastTopSet.reps}
          </div>
        )}
      </div>
      <input
        inputMode="decimal"
        placeholder="Weight"
        value={w}
        onChange={(e) => setW(e.target.value)}
        className="w-20 bg-transparent text-sm focus:outline-none border-b border-[color:var(--color-border)] py-1"
      />
      <input
        inputMode="numeric"
        placeholder="Reps"
        value={r}
        onChange={(e) => setR(e.target.value)}
        className="w-16 bg-transparent text-sm focus:outline-none border-b border-[color:var(--color-border)] py-1"
      />
      {suggested && (
        <button
          className="text-[10px] text-[color:var(--color-accent)] underline"
          onClick={() => {
            setW(String(suggested.weight))
            setR(String(suggested.reps))
          }}
        >
          {fmtWeight(suggested.weight)}×{suggested.reps}
        </button>
      )}
      <Button
        variant="secondary"
        onClick={() => onSave(w === '' ? null : Number(w), r === '' ? null : Number(r))}
      >
        Save
      </Button>
    </li>
  )
}
