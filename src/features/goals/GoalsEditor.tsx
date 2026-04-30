import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { useGoals, useUpsertExerciseGoal, useUpsertVolumeGoal } from '@/lib/queries/goals'
import { fmtWeight } from '@/lib/format'

const SMALLEST_PLATE_LB = 2.5

export function GoalsEditor() {
  const allEx = useAllExercises()
  const goals = useGoals()
  const upsertExGoal = useUpsertExerciseGoal()
  const upsertVolGoal = useUpsertVolumeGoal()

  const muscleGroups = useMemo(() => {
    const set = new Set<string>()
    for (const e of allEx.data ?? []) set.add(e.muscle_group)
    return Array.from(set).sort()
  }, [allEx.data])

  const exerciseHeads = useMemo(() => {
    if (!allEx.data) return []
    const seen = new Map<string, { id: string; name: string }>()
    for (const e of allEx.data) {
      const current = seen.get(e.name)
      if (!current || (allEx.data.find((x) => x.id === current.id)?.created_at ?? '') < e.created_at) {
        seen.set(e.name, { id: e.id, name: e.name })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allEx.data])

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2">Per exercise</h3>
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
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2">Weekly volume</h3>
        <ul className="space-y-2">
          {muscleGroups.map((m) => {
            const goal = (goals.data ?? []).find((g) => g.muscle_group === m && !g.exercise_id)
            return (
              <VolumeGoalRow
                key={m}
                muscleGroup={m}
                target={goal?.weekly_volume_target ?? null}
                onSave={(weekly_volume_target) => upsertVolGoal.mutate({ muscle_group: m, weekly_volume_target })}
              />
            )
          })}
        </ul>
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

function VolumeGoalRow({
  muscleGroup,
  target,
  onSave,
}: {
  muscleGroup: string
  target: number | null
  onSave: (v: number) => void
}) {
  const [v, setV] = useState<string>(target?.toString() ?? '')
  return (
    <li className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-2">
      <div className="flex-1 text-sm">{muscleGroup}</div>
      <input
        inputMode="numeric"
        placeholder="Weekly lb"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="w-24 bg-transparent text-sm focus:outline-none border-b border-[color:var(--color-border)] py-1"
      />
      <Button variant="secondary" onClick={() => v !== '' && onSave(Number(v))}>
        Save
      </Button>
    </li>
  )
}
