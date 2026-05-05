import { useCallback, useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useSession } from './sessionStore'
import { useExercises } from '@/lib/queries/exercises'
import {
  useSessionSets,
  useEndSession,
  useLogSet,
  useUpdateSetRest,
  useCancelSession,
  useLastSetsForExercises,
} from '@/lib/queries/sessions'
import { useSessionSwaps, useCreateSwap } from '@/lib/queries/swaps'
import { SetRow } from './SetRow'
import { useVisibilityTracking } from './useVisibilityTracking'
import { useRestNotification, scheduleRestNotification, cancelRestNotification } from './useRestNotification'
import { restTargetSeconds } from './restTargets'
import { RestTimerBanner } from './RestTimerBanner'
import { ExerciseSwapSheet } from './ExerciseSwapSheet'
import { fmtDuration } from '@/lib/format'
import { isAiFeaturesEnabled } from '@/lib/ai/featureFlag'
import type { Exercise } from '@/lib/supabase/database.types'
import type { SwapSuggestion } from '@/lib/ai/schemas'

export function ActiveSessionView({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const session = useSession()
  const sessionId = session.activeSessionId
  const workoutDayId = session.workoutDayId
  const restTimer = session.restTimer

  useVisibilityTracking(sessionId !== null)
  useRestNotification(sessionId)

  const exercises = useExercises(workoutDayId ?? undefined)
  const sets = useSessionSets(sessionId ?? undefined)
  const swaps = useSessionSwaps(sessionId ?? undefined)
  const createSwap = useCreateSwap()
  const exerciseIds = useMemo(
    () => (exercises.data ?? []).map((e) => e.id),
    [exercises.data],
  )
  const lastSets = useLastSetsForExercises(exerciseIds)

  const endSession = useEndSession()
  const logSet = useLogSet()
  const updateRest = useUpdateSetRest()
  const cancelSession = useCancelSession()

  const [swapTarget, setSwapTarget] = useState<Exercise | null>(null)

  const groups = useMemo(() => {
    const sorted = [...(exercises.data ?? [])].sort((a, b) => a.order_index - b.order_index)
    return sorted.map((e) => [e])
  }, [exercises.data])

  const skippedIds = useMemo(() => {
    const s = new Set<string>()
    for (const set of sets.data ?? []) if (set.is_skipped) s.add(set.exercise_id)
    return s
  }, [sets.data])

  const setsByExercise = useMemo(() => {
    const m = new Map<string, number>()
    for (const set of sets.data ?? []) {
      if (set.is_skipped) continue
      m.set(set.exercise_id, (m.get(set.exercise_id) ?? 0) + 1)
    }
    return m
  }, [sets.data])

  const prefillByExercise = useMemo(() => {
    const fmt = (n: number | null) => (n == null ? '' : String(n))
    const m = new Map<string, { weight: string; reps: string; rpe: string }>()
    // Prefer most recent non-warmup, non-skipped set in the current session.
    const sortedCurrent = [...(sets.data ?? [])].sort(
      (a, b) => b.set_order - a.set_order,
    )
    for (const s of sortedCurrent) {
      if (s.is_warmup || s.is_skipped) continue
      if (m.has(s.exercise_id)) continue
      m.set(s.exercise_id, { weight: fmt(s.weight), reps: fmt(s.reps), rpe: fmt(s.rpe) })
    }
    // Fall back to the last set ever logged for this exercise.
    const last = lastSets.data ?? {}
    for (const [exId, s] of Object.entries(last)) {
      if (m.has(exId)) continue
      m.set(exId, { weight: fmt(s.weight), reps: fmt(s.reps), rpe: fmt(s.rpe) })
    }
    return m
  }, [sets.data, lastSets.data])

  // Map of planned_exercise_id -> swap info for display
  const swapMap = useMemo(() => {
    const m = new Map<string, { name: string; muscle_group: string; type: string }>()
    for (const s of swaps.data ?? []) {
      m.set(s.planned_exercise_id, {
        name: s.performed_exercise_name,
        muscle_group: s.performed_muscle_group,
        type: s.performed_type,
      })
    }
    return m
  }, [swaps.data])

  const handleSwapConfirm = async (suggestion: SwapSuggestion) => {
    if (!swapTarget || !sessionId) return
    await createSwap.mutateAsync({
      session_id: sessionId,
      planned_exercise_id: swapTarget.id,
      performed_exercise_name: suggestion.name,
      performed_muscle_group: suggestion.muscle_group,
      performed_type: suggestion.type,
      reason: null, // reason is captured in the sheet but we store it on the swap row
    })
    setSwapTarget(null)
  }

  const finalizeRest = useCallback(() => {
    const t = useSession.getState().restTimer
    if (!t || !sessionId) return
    const restMs = Math.max(0, Date.now() - t.startedAt)
    updateRest.mutate({ setId: t.setId, sessionId, restMs })
    cancelRestNotification()
    session.clearRest()
  }, [sessionId, updateRest, session])

  if (!sessionId || !workoutDayId) {
    return null
  }

  const onLogSet = async (
    e: Exercise,
    payload: { weight: number | null; reps: number | null; rpe: number | null; isWarmup: boolean; note: string | null },
  ) => {
    finalizeRest()
    const setOrder = (setsByExercise.get(e.id) ?? 0) + 1
    const target = payload.isWarmup ? null : restTargetSeconds(e.type)
    const inserted = await logSet.mutateAsync({
      session_id: sessionId,
      exercise_id: e.id,
      set_order: setOrder,
      weight: payload.weight,
      reps: payload.reps,
      rpe: payload.rpe,
      is_warmup: payload.isWarmup,
      is_skipped: false,
      note: payload.note,
      rest_target_seconds: target,
    })
    if (!payload.isWarmup && target != null) {
      scheduleRestNotification(target, `Rest done — ${e.name}`)
      session.startRest({
        setId: inserted.id,
        exerciseId: e.id,
        exerciseName: e.name,
        targetSeconds: target,
        // eslint-disable-next-line react-hooks/purity
        startedAt: Date.now(),
      })
    }
  }

  const onSkip = (e: Exercise) => {
    logSet.mutate({
      session_id: sessionId,
      exercise_id: e.id,
      set_order: 0,
      weight: null,
      reps: null,
      rpe: null,
      is_warmup: false,
      is_skipped: true,
      note: null,
      rest_target_seconds: null,
    })
  }

  const onComplete2 = async () => {
    finalizeRest()
    await endSession.mutateAsync({
      id: sessionId,
      foreground_ms: session.foregroundMs,
      background_ms: session.backgroundMs,
    })
    onComplete()
  }

  const onCancelClick = async () => {
    if (!window.confirm('Cancel workout? All logged sets will be discarded.')) return
    cancelRestNotification()
    session.clearRest()
    await cancelSession.mutateAsync({ id: sessionId })
    session.clear()
    onCancel()
  }

  const elapsed = session.startedAt ? Date.now() - session.startedAt : 0

  return (
    <Screen
      title="Session"
      action={
        <Button variant="primary" onClick={onComplete2} disabled={endSession.isPending}>
          {endSession.isPending ? 'Ending…' : 'Complete'}
        </Button>
      }
    >
      <div className="text-xs text-[color:var(--color-muted)] mb-4">
        Elapsed {fmtDuration(elapsed)} · Off-app {fmtDuration(session.backgroundMs)}
      </div>

      <ul className="space-y-4 mb-4">
        {groups.map((g, i) => (
          <li key={i} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            {g.map((e) => {
              const skipped = skippedIds.has(e.id)
              const count = setsByExercise.get(e.id) ?? 0
              const swap = swapMap.get(e.id)
              const displayName = swap?.name ?? e.name
              const displayMuscle = swap?.muscle_group ?? e.muscle_group
              return (
                <div key={e.id} className={g.length > 1 ? 'mb-4 last:mb-0' : ''}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">
                        {displayName}
                        {swap && (
                          <span className="ml-2 text-xs text-purple-300/80 font-normal">(swapped)</span>
                        )}
                      </div>
                      <div className="text-xs text-[color:var(--color-muted)]">
                        {displayMuscle} · {e.type} · {count}/{e.default_sets} sets
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!skipped && isAiFeaturesEnabled() && !swap && (
                        <button
                          className="text-xs text-purple-300 underline min-h-[44px] px-2"
                          onClick={() => setSwapTarget(e)}
                        >
                          Swap
                        </button>
                      )}
                      {!skipped && (
                        <button
                          className="text-xs text-[color:var(--color-muted)] underline min-h-[44px] px-2"
                          onClick={() => onSkip(e)}
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                  {skipped ? (
                    <div className="text-xs text-red-300/80">Skipped</div>
                  ) : (
                    <SetRow
                      setNumber={count + 1}
                      prefill={prefillByExercise.get(e.id) ?? null}
                      onLog={(p) => onLogSet(e, p)}
                    />
                  )}
                </div>
              )
            })}
          </li>
        ))}
      </ul>

      <div className="pb-32">
        <Button
          variant="danger"
          className="w-full"
          onClick={onCancelClick}
          disabled={cancelSession.isPending}
        >
          {cancelSession.isPending ? 'Cancelling…' : 'Cancel workout'}
        </Button>
      </div>

      {restTimer && <RestTimerBanner timer={restTimer} onSkip={finalizeRest} />}

      {swapTarget && (
        <ExerciseSwapSheet
          exercise={swapTarget}
          open={!!swapTarget}
          onClose={() => setSwapTarget(null)}
          onSwap={handleSwapConfirm}
        />
      )}
    </Screen>
  )
}
