import { useMemo, useState } from 'react'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { isAiFeaturesEnabled } from '@/lib/ai/featureFlag'
import { requestGoalSuggestions } from '@/lib/ai/client'
import type { GoalSuggestionsPayload } from '@/lib/ai/client'
import { computeNextTarget } from '@/lib/stats/targets'
import type { ExerciseTarget } from '@/lib/stats/targets'
import { useTargetOverrides } from './targetOverrideStore'
import { fmtWeight } from '@/lib/format'

const RECENT_SETS_LIMIT = 5

type ExerciseHead = { id: string; name: string; muscle_group: string; type: string }

export function GoalsEditor() {
  const allEx = useAllExercises()
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)

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

  const allLineageIds = useMemo(() => {
    if (!allEx.data || exerciseHeads.length === 0) return [] as string[]
    const ids: string[] = []
    for (const head of exerciseHeads) {
      ids.push(...resolveExerciseLineage(head.id, allEx.data))
    }
    return [...new Set(ids)]
  }, [allEx.data, exerciseHeads])

  const allHistory = useExerciseHistory(allLineageIds)

  // Per-exercise: last top set + recent sets for AI
  const exerciseData = useMemo(() => {
    if (!allHistory.data || !allEx.data) return new Map<string, { lastTopSet: { weight: number | null; reps: number | null; rpe: number | null; logged_at: string } | null; recentSets: GoalSuggestionsPayload['exercises'][number]['recentSets'] }>()
    const map = new Map<string, { lastTopSet: { weight: number | null; reps: number | null; rpe: number | null; logged_at: string } | null; recentSets: GoalSuggestionsPayload['exercises'][number]['recentSets'] }>()
    for (const head of exerciseHeads) {
      const lineage = new Set(resolveExerciseLineage(head.id, allEx.data))
      const working = allHistory.data
        .filter((s) => lineage.has(s.exercise_id) && !s.is_warmup && !s.is_skipped)
      const recentSets = working
        .slice(0, RECENT_SETS_LIMIT)
        .map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, logged_at: s.logged_at }))
      // Last top set: most recent session's highest-weight working set
      const withWeight = working.filter((s) => s.weight != null && s.reps != null)
      let lastTopSet: { weight: number | null; reps: number | null; rpe: number | null; logged_at: string } | null = null
      if (withWeight.length > 0) {
        const newestSession = withWeight.filter((s) => s.session_id === withWeight[0].session_id)
        const best = newestSession.reduce(
          (b, s) => (s.weight! > (b?.weight ?? -Infinity) ? s : b),
          null as null | (typeof withWeight)[number],
        )
        if (best) lastTopSet = { weight: best.weight, reps: best.reps, rpe: best.rpe, logged_at: best.logged_at }
      } else if (working.length > 0) {
        // Bodyweight exercises (no weight)
        const s = working[0]
        lastTopSet = { weight: s.weight, reps: s.reps, rpe: s.rpe, logged_at: s.logged_at }
      }
      map.set(head.id, { lastTopSet, recentSets })
    }
    return map
  }, [allHistory.data, allEx.data, exerciseHeads])

  if (!exerciseHeads.length) {
    return <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>No exercises in active plan.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 4 }}>
        Per exercise targets
      </div>
      {exerciseHeads.map((e) => (
        <ExerciseTargetRow
          key={e.id}
          exercise={e}
          data={exerciseData.get(e.id) ?? { lastTopSet: null, recentSets: [] }}
        />
      ))}
    </div>
  )
}

function ExerciseTargetRow({
  exercise,
  data,
}: {
  exercise: ExerciseHead
  data: {
    lastTopSet: { weight: number | null; reps: number | null; rpe: number | null; logged_at: string } | null
    recentSets: GoalSuggestionsPayload['exercises'][number]['recentSets']
  }
}) {
  const overrides = useTargetOverrides((s) => s.overrides)
  const setOverride = useTargetOverrides((s) => s.setOverride)
  const clearOverride = useTargetOverrides((s) => s.clearOverride)

  const [editing, setEditing] = useState(false)
  const [editW, setEditW] = useState('')
  const [editR, setEditR] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const key = exercise.name.trim().toLowerCase()
  const override = overrides[key]
  const overrideFresh = override && (!data.lastTopSet || override.createdAt > new Date(data.lastTopSet.logged_at).getTime())

  const computed: ExerciseTarget | null = computeNextTarget(data.lastTopSet)

  const effective: ExerciseTarget | null = overrideFresh
    ? { weight: override.weight, reps: override.reps, basis: 'override' }
    : computed

  const startEdit = () => {
    const base = effective ?? { weight: null, reps: null }
    setEditW(base.weight != null ? String(base.weight) : '')
    setEditR(base.reps != null ? String(base.reps) : '')
    setEditing(true)
  }

  const saveEdit = () => {
    setOverride(exercise.name, {
      weight: editW === '' ? null : Number(editW),
      reps: editR === '' ? null : Number(editR),
      source: 'manual',
    })
    setEditing(false)
  }

  const handleAiAdvice = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const payload: GoalSuggestionsPayload = {
        exercises: [{
          name: exercise.name,
          muscle_group: exercise.muscle_group,
          type: exercise.type,
          recentSets: data.recentSets,
        }],
      }
      const result = await requestGoalSuggestions(payload)
      const suggestion = result.suggestions.find(
        (s) => s.exercise_name.toLowerCase() === exercise.name.toLowerCase(),
      ) ?? result.suggestions[0]
      if (suggestion) {
        setOverride(exercise.name, {
          weight: suggestion.target_weight,
          reps: suggestion.target_reps,
          source: 'ai',
        })
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      border: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{exercise.name}</div>
          {data.lastTopSet && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', marginTop: 2 }}>
              Last: {fmtWeight(data.lastTopSet.weight)} {'\u00d7'} {data.lastTopSet.reps ?? '—'}
              {data.lastTopSet.rpe != null && ` @ RPE ${data.lastTopSet.rpe}`}
            </div>
          )}
        </div>
        {overrideFresh && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
            textTransform: 'uppercase', padding: '2px 6px', borderRadius: 6,
            background: override.source === 'ai' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
            color: override.source === 'ai' ? '#c084fc' : '#60a5fa',
          }}>
            {override.source}
          </span>
        )}
      </div>

      {/* Target display */}
      {effective ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
            Target
          </span>
          <button
            onClick={startEdit}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
              color: 'var(--color-text)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, textDecoration: 'underline',
              textDecorationColor: 'var(--color-border)', textUnderlineOffset: 3,
            }}
          >
            {effective.weight != null ? `${effective.weight} lb` : 'BW'} {'\u00d7'} {effective.reps ?? '—'}
          </button>
          {effective.basis !== 'override' && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-faint)', textTransform: 'uppercase' }}>
              {effective.basis === 'progression' ? '+wt' : effective.basis === 'hold' ? '+rep' : 'same'}
            </span>
          )}
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-faint)' }}>
          No history yet
        </div>
      )}

      {/* Inline edit */}
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input
            inputMode="decimal"
            placeholder="Weight"
            value={editW}
            onChange={(e) => setEditW(e.target.value)}
            style={{
              width: 72, padding: '6px 8px', borderRadius: 8,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 13,
              outline: 'none',
            }}
          />
          <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>{'\u00d7'}</span>
          <input
            inputMode="numeric"
            placeholder="Reps"
            value={editR}
            onChange={(e) => setEditR(e.target.value)}
            style={{
              width: 56, padding: '6px 8px', borderRadius: 8,
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            onClick={saveEdit}
            style={{
              padding: '6px 12px', borderRadius: 8, border: 'none',
              background: 'var(--color-accent)', color: 'var(--color-accent-ink)',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', minHeight: 32,
            }}
          >
            Set
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{
              padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
              cursor: 'pointer', minHeight: 32,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!editing && (
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {isAiFeaturesEnabled() && (
            <button
              onClick={handleAiAdvice}
              disabled={aiLoading}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)',
                color: '#c084fc', fontFamily: 'var(--font-mono)', fontSize: 10,
                cursor: 'pointer', opacity: aiLoading ? 0.5 : 1,
              }}
            >
              {aiLoading ? 'Thinking...' : 'AI advice'}
            </button>
          )}
          {overrideFresh && (
            <button
              onClick={() => clearOverride(exercise.name)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: 10,
                cursor: 'pointer',
              }}
            >
              Clear override
            </button>
          )}
        </div>
      )}

      {aiError && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#f87171', marginTop: 2 }}>
          {aiError}
        </div>
      )}
    </div>
  )
}
