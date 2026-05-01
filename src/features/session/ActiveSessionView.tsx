import { useCallback, useMemo } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useSession } from './sessionStore'
import { useExercises } from '@/lib/queries/exercises'
import { useSessionSets, useEndSession, useLogSet, useUpdateSetRest } from '@/lib/queries/sessions'
import { SetRow } from './SetRow'
import { useVisibilityTracking } from './useVisibilityTracking'
import { useRestNotification, scheduleRestNotification, cancelRestNotification } from './useRestNotification'
import { restTargetSeconds } from './restTargets'
import { RestTimerBanner } from './RestTimerBanner'
import { fmtDuration } from '@/lib/format'
import type { Exercise } from '@/lib/supabase/database.types'

export function ActiveSessionView({ onComplete }: { onComplete: () => void }) {
  const session = useSession()
  const sessionId = session.activeSessionId
  const workoutDayId = session.workoutDayId
  const restTimer = session.restTimer

  useVisibilityTracking(sessionId !== null)
  useRestNotification(sessionId)

  const exercises = useExercises(workoutDayId ?? undefined)
  const sets = useSessionSets(sessionId ?? undefined)

  const endSession = useEndSession()
  const logSet = useLogSet()
  const updateRest = useUpdateSetRest()

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

      <ul className="space-y-4 pb-32">
        {groups.map((g, i) => (
          <li key={i} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            {g.map((e) => {
              const skipped = skippedIds.has(e.id)
              const count = setsByExercise.get(e.id) ?? 0
              return (
                <div key={e.id} className={g.length > 1 ? 'mb-4 last:mb-0' : ''}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-[color:var(--color-muted)]">
                        {e.muscle_group} · {e.type} · {count}/{e.default_sets} sets
                      </div>
                    </div>
                    {!skipped && (
                      <button
                        className="text-xs text-[color:var(--color-muted)] underline min-h-[44px] px-2"
                        onClick={() => onSkip(e)}
                      >
                        Skip
                      </button>
                    )}
                  </div>
                  {skipped ? (
                    <div className="text-xs text-red-300/80">Skipped</div>
                  ) : (
                    <SetRow setNumber={count + 1} onLog={(p) => onLogSet(e, p)} />
                  )}
                </div>
              )
            })}
          </li>
        ))}
      </ul>

      {restTimer && <RestTimerBanner timer={restTimer} onSkip={finalizeRest} />}
    </Screen>
  )
}
