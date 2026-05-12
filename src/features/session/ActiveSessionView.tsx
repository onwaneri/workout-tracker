import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { ExerciseOverviewScreen } from './ExerciseOverviewScreen'
import { fmtDuration } from '@/lib/format'
import { BODYWEIGHT_LBS, isBodyweightExercise } from '@/lib/constants'
import { isAiFeaturesEnabled } from '@/lib/ai/featureFlag'
import type { Exercise } from '@/lib/supabase/database.types'
import type { SwapSuggestion } from '@/lib/ai/schemas'

function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h13l-3-3M17 17H4l3 3"/>
    </svg>
  )
}

function SkipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5l9 7-9 7V5ZM18 5v14"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6"/>
    </svg>
  )
}

export function ActiveSessionView({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const sessionId = useSession((s) => s.activeSessionId)
  const workoutDayId = useSession((s) => s.workoutDayId)
  const restTimer = useSession((s) => s.restTimer)
  const startRestFn = useSession((s) => s.startRest)
  const clearRestFn = useSession((s) => s.clearRest)
  const foregroundMs = useSession((s) => s.foregroundMs)
  const backgroundMs = useSession((s) => s.backgroundMs)
  const startedAt = useSession((s) => s.startedAt)

  useVisibilityTracking(sessionId !== null)
  useRestNotification(sessionId)

  const exercises = useExercises(workoutDayId ?? undefined)
  const sets = useSessionSets(sessionId ?? undefined)
  const swaps = useSessionSwaps(sessionId ?? undefined)
  const createSwap = useCreateSwap()
  const exerciseIds = useMemo(() => (exercises.data ?? []).map((e) => e.id), [exercises.data])
  const lastSets = useLastSetsForExercises(exerciseIds)

  const endSession = useEndSession()
  const logSet = useLogSet()
  const updateRest = useUpdateSetRest()
  const cancelSession = useCancelSession()

  const [swapTarget, setSwapTarget] = useState<Exercise | null>(null)
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [view, setView] = useState<'overview' | 'detail'>('overview')
  const [pendingReturnToOverview, setPendingReturnToOverview] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)

  const sortedExercises = useMemo(
    () => [...(exercises.data ?? [])].sort((a, b) => a.order_index - b.order_index),
    [exercises.data],
  )

  // Auto-advance to first incomplete exercise when data loads
  useEffect(() => {
    if (!sortedExercises.length || !sets.data) return
    const skippedIds = new Set(sets.data.filter((s) => s.is_skipped).map((s) => s.exercise_id))
    const setsByEx = new Map<string, number>()
    for (const s of sets.data) {
      if (!s.is_skipped) setsByEx.set(s.exercise_id, (setsByEx.get(s.exercise_id) ?? 0) + 1)
    }
    const firstIncomplete = sortedExercises.findIndex(
      (e) => !skippedIds.has(e.id) && (setsByEx.get(e.id) ?? 0) < e.default_sets,
    )
    if (firstIncomplete !== -1) setCurrentExIdx(firstIncomplete)
  }, [sortedExercises.length, sets.data]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const setsForCurrent = useMemo(() => {
    const e = sortedExercises[currentExIdx]
    if (!e) return []
    return (sets.data ?? []).filter((s) => s.exercise_id === e.id && !s.is_skipped).sort((a, b) => a.set_order - b.set_order)
  }, [sets.data, sortedExercises, currentExIdx])

  const prefillByExercise = useMemo(() => {
    const fmt = (n: number | null) => (n == null ? '' : String(n))
    const m = new Map<string, { weight: string; reps: string; rpe: string }>()
    const sortedCurrent = [...(sets.data ?? [])].sort((a, b) => b.set_order - a.set_order)
    for (const s of sortedCurrent) {
      if (s.is_warmup || s.is_skipped) continue
      if (m.has(s.exercise_id)) continue
      m.set(s.exercise_id, { weight: fmt(s.weight), reps: fmt(s.reps), rpe: fmt(s.rpe) })
    }
    const last = lastSets.data ?? {}
    for (const [exId, s] of Object.entries(last)) {
      if (m.has(exId)) continue
      m.set(exId, { weight: fmt(s.weight), reps: fmt(s.reps), rpe: fmt(s.rpe) })
    }
    return m
  }, [sets.data, lastSets.data])

  const swapMap = useMemo(() => {
    const m = new Map<string, { name: string; muscle_group: string; type: string }>()
    for (const s of swaps.data ?? []) {
      m.set(s.planned_exercise_id, { name: s.performed_exercise_name, muscle_group: s.performed_muscle_group, type: s.performed_type })
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
      reason: null,
    })
    setSwapTarget(null)
  }

  const finalizeRest = useCallback(() => {
    const t = useSession.getState().restTimer
    if (!t || !sessionId) return
    const restMs = Math.max(0, Date.now() - t.startedAt)
    updateRest.mutate({ setId: t.setId, sessionId, restMs })
    cancelRestNotification()
    clearRestFn()
    setPendingReturnToOverview((shouldReturn) => {
      if (shouldReturn) setView('overview')
      return false
    })
  }, [sessionId, updateRest, clearRestFn])

  const addRestTime = useCallback((extraSeconds: number) => {
    const t = useSession.getState().restTimer
    if (!t) return
    // Shift startedAt back so remaining time increases by extraSeconds
    startRestFn({ ...t, startedAt: t.startedAt - extraSeconds * 1000 })
  }, [startRestFn])

  if (!sessionId || !workoutDayId) return null

  const currentEx = sortedExercises[currentExIdx] ?? null
  const totalSetsLogged = sets.data?.filter((s) => !s.is_warmup && !s.is_skipped).length ?? 0
  const elapsed = startedAt ? Date.now() - startedAt : 0

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
      startRestFn({ setId: inserted.id, exerciseId: e.id, exerciseName: e.name, targetSeconds: target, startedAt: Date.now() })
    }
    // When last working set is done, return to overview after rest (or immediately if no rest)
    if (!payload.isWarmup && setOrder >= e.default_sets) {
      if (target != null) {
        setPendingReturnToOverview(true)
      } else {
        setView('overview')
      }
    }
  }

  const onSkip = (e: Exercise) => {
    logSet.mutate({
      session_id: sessionId, exercise_id: e.id, set_order: 0,
      weight: null, reps: null, rpe: null,
      is_warmup: false, is_skipped: true, note: null, rest_target_seconds: null,
    })
    setView('overview')
  }

  const onComplete2 = async () => {
    setEndError(null)
    finalizeRest()
    try {
      await endSession.mutateAsync({ id: sessionId, foreground_ms: foregroundMs, background_ms: backgroundMs })
      onComplete()
    } catch (e) {
      setEndError(e instanceof Error ? e.message : 'Failed to save session')
    }
  }

  const onCancelClick = async () => {
    if (!window.confirm('Cancel workout? All logged sets will be discarded.')) return
    cancelRestNotification()
    clearRestFn()
    await cancelSession.mutateAsync({ id: sessionId })
    useSession.getState().clear()
    onCancel()
  }

  const swap = currentEx ? swapMap.get(currentEx.id) : null
  const displayName = swap?.name ?? currentEx?.name ?? ''
  const displayMuscle = swap?.muscle_group ?? currentEx?.muscle_group ?? ''
  const currentSetNum = currentEx ? (setsByExercise.get(currentEx.id) ?? 0) + 1 : 1
  const isCurrentSkipped = currentEx ? skippedIds.has(currentEx.id) : false

  if (view === 'overview') {
    return (
      <ExerciseOverviewScreen
        exercises={sortedExercises}
        setsByExercise={setsByExercise}
        skippedIds={skippedIds}
        swapMap={swapMap}
        elapsed={elapsed}
        totalSetsLogged={totalSetsLogged}
        onSelectExercise={(idx) => { setCurrentExIdx(idx); setView('detail') }}
        onDone={onComplete2}
        onCancel={onCancelClick}
        endPending={endSession.isPending}
        cancelPending={cancelSession.isPending}
        endError={endError}
      />
    )
  }

  return (
    <section style={{
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
      background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)',
    }}>
      {/* Detail view header */}
      <div style={{ padding: '6px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => setView('overview')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'var(--color-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer', minHeight: 44,
          }}
        >
          ← Back
        </button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
          {currentExIdx + 1} / {sortedExercises.length}
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px 120px', display: 'flex', flexDirection: 'column' }}>
        {currentEx && (
          <>
            {/* Exercise heading */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                  {displayMuscle}
                  {swap && <span style={{ color: 'var(--color-accent)', marginLeft: 6 }}>swapped</span>}
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', margin: '4px 0 0', lineHeight: 1 }}>
                  {displayName}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  target {currentEx.default_sets}× · {currentEx.type} · rest {fmtDuration(restTargetSeconds(currentEx.type) * 1000)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {isAiFeaturesEnabled() && !swap && (
                  <IconBtn onClick={() => setSwapTarget(currentEx)} title="Swap">
                    <SwapIcon />
                  </IconBtn>
                )}
                {!isCurrentSkipped && (
                  <IconBtn onClick={() => onSkip(currentEx)} title="Skip">
                    <SkipIcon />
                  </IconBtn>
                )}
              </div>
            </div>

            {/* Set ladder */}
            {setsForCurrent.length > 0 && (
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '4px 0', marginBottom: 18 }}>
                {setsForCurrent.map((s, i) => (
                  <div key={s.id} style={{
                    display: 'grid', gridTemplateColumns: '40px 1fr 1fr 60px 24px', gap: 10, alignItems: 'center',
                    padding: '11px 14px', borderBottom: '1px solid var(--color-border)',
                    fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text)',
                  }}>
                    <span style={{ color: 'var(--color-muted)', fontSize: 10 }}>{s.is_warmup ? 'WUP' : `S${i + 1}`}</span>
                    <span><span style={{ color: 'var(--color-faint)', fontSize: 10 }}>WT </span>{s.weight ?? '—'}</span>
                    <span><span style={{ color: 'var(--color-faint)', fontSize: 10 }}>RP </span>{s.reps ?? '—'}</span>
                    <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>{s.rpe != null ? `RPE ${s.rpe}` : '—'}</span>
                    <span style={{ color: 'var(--color-accent)', display: 'flex' }}><CheckIcon /></span>
                  </div>
                ))}
                {!isCurrentSkipped && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '40px 1fr 1fr 60px 24px', gap: 10, alignItems: 'center',
                    padding: '12px 14px', background: 'var(--color-accent-soft)', borderRadius: '0 0 15px 15px',
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                  }}>
                    <span style={{ color: 'var(--color-accent)', fontSize: 11, fontWeight: 600 }}>S{currentSetNum}</span>
                    <span style={{ color: 'var(--color-muted)' }}>—</span>
                    <span style={{ color: 'var(--color-muted)' }}>—</span>
                    <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>—</span>
                    <span style={{ color: 'var(--color-accent)', fontSize: 8 }}>●</span>
                  </div>
                )}
              </div>
            )}

            {/* Input form */}
            {isCurrentSkipped ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-muted)' }}>
                Skipped
              </div>
            ) : (
              <SetRow
                setNumber={currentSetNum}
                prefill={prefillByExercise.get(currentEx.id) ?? null}
                bodyweight={isBodyweightExercise(displayName) ? BODYWEIGHT_LBS : null}
                onLog={(p) => onLogSet(currentEx, p)}
              />
            )}
          </>
        )}
      </div>

      {restTimer && <RestTimerBanner timer={restTimer} onSkip={finalizeRest} onAddTime={addRestTime} />}

      {swapTarget && (
        <ExerciseSwapSheet
          exercise={swapTarget}
          open={!!swapTarget}
          onClose={() => setSwapTarget(null)}
          onSwap={handleSwapConfirm}
        />
      )}
    </section>
  )
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 44, height: 44, borderRadius: 12,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)', color: 'var(--color-text)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
