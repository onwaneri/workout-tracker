import { useEffect, useMemo, useRef, useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useSession, useSessionSets, useSessions } from '@/lib/queries/sessions'
import { useExercises } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { useAllWorkoutDays } from '@/lib/queries/plans'
import { useSessionSwaps } from '@/lib/queries/swaps'
import { totalVolume, volumeByMuscleGroup } from '@/lib/stats/volume'
import { totalRestMs } from '@/lib/stats/rest'
import { detectPRs } from '@/lib/stats/prs'
import { workoutDayGroup } from '@/lib/stats/dayGroup'
import { fmtDuration, fmtVolume, fmtWeight } from '@/lib/format'
import { isAiFeaturesEnabled } from '@/lib/ai/featureFlag'
import { requestSessionInsights } from '@/lib/ai/client'
import type { SessionInsights } from '@/lib/ai/schemas'
import { Confetti } from './Confetti'

type InsightsState =
  | { status: 'idle' }
  | { status: 'insufficient' }
  | { status: 'loading' }
  | { status: 'ok'; data: SessionInsights }
  | { status: 'error'; message: string }

export function SessionSummary({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const sess = useSession(sessionId)
  const sets = useSessionSets(sessionId)
  const swaps = useSessionSwaps(sessionId)
  const dayExercises = useExercises(sess.data?.workout_day_id)
  const allEx = useAllExercises()
  const allSessions = useSessions()
  const allDays = useAllWorkoutDays()

  const lineageIds = useMemo(() => {
    if (!dayExercises.data || !allEx.data) return []
    const ids = new Set<string>()
    for (const e of dayExercises.data) for (const id of resolveExerciseLineage(e.id, allEx.data)) ids.add(id)
    return Array.from(ids)
  }, [dayExercises.data, allEx.data])

  const history = useExerciseHistory(lineageIds)

  const setsThisSession = sets.data ?? []
  const priorSets = useMemo(
    () => (history.data ?? []).filter((s) => s.session_id !== sessionId),
    [history.data, sessionId],
  )
  const prs = useMemo(() => detectPRs(setsThisSession, priorSets), [setsThisSession, priorSets])

  // Find the most recent prior session in the same day group (Upper A + Upper B = "Upper").
  const priorSession = useMemo(() => {
    if (!sess.data || !allSessions.data || !allDays.data) return null
    const dayById = new Map(allDays.data.map((d) => [d.id, d]))
    const currentGroup = workoutDayGroup(dayById.get(sess.data.workout_day_id)?.name ?? '')
    if (!currentGroup) return null
    return (
      allSessions.data
        .filter((s) => {
          if (s.id === sessionId) return false
          if (!s.ended_at) return false
          const day = dayById.get(s.workout_day_id)
          return day ? workoutDayGroup(day.name) === currentGroup : false
        })
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0] ?? null
    )
  }, [sess.data, allSessions.data, allDays.data, sessionId])

  // Pre-compute per-exercise stats for current and prior sessions.
  const exerciseStats = useMemo(() => {
    if (!dayExercises.data || !sets.data || !history.data) return null
    if (!priorSession) return null

    const priorSessionSets = history.data.filter((s) => s.session_id === priorSession.id)

    return dayExercises.data.map((e) => {
      const curSets = sets.data.filter((s) => s.exercise_id === e.id && !s.is_warmup && !s.is_skipped)
      const priSets = priorSessionSets.filter((s) => s.exercise_id === e.id && !s.is_warmup && !s.is_skipped)

      const stats = (arr: typeof curSets) => ({
        bestWeight: arr.reduce<number | null>((m, s) => (s.weight != null ? Math.max(m ?? 0, s.weight) : m), null),
        totalReps: arr.reduce((s, r) => s + (r.reps ?? 0), 0),
        avgRpe:
          arr.filter((s) => s.rpe != null).length > 0
            ? arr.reduce((s, r) => s + (r.rpe ?? 0), 0) / arr.filter((s) => s.rpe != null).length
            : null,
        workingSets: arr.length,
      })

      return {
        name: e.name,
        muscle_group: e.muscle_group,
        current: stats(curSets),
        prior: stats(priSets),
      }
    })
  }, [dayExercises.data, sets.data, history.data, priorSession])

  const [insights, setInsights] = useState<InsightsState>({ status: 'idle' })
  const firedRef = useRef(false)

  useEffect(() => {
    if (!isAiFeaturesEnabled()) return
    if (firedRef.current) return

    // Wait for all data to be ready.
    if (
      !sess.data ||
      !sets.data ||
      !dayExercises.data ||
      !history.data ||
      !allSessions.data ||
      !allDays.data
    ) return

    firedRef.current = true

    if (!priorSession) {
      setInsights({ status: 'insufficient' })
      return
    }

    if (!exerciseStats || exerciseStats.length === 0) {
      setInsights({ status: 'insufficient' })
      return
    }

    const dayName = allDays.data.find((d) => d.id === sess.data!.workout_day_id)?.name ?? 'Workout'

    setInsights({ status: 'loading' })
    requestSessionInsights({ workoutDayName: dayName, exercises: exerciseStats })
      .then((data) => setInsights({ status: 'ok', data }))
      .catch((err: unknown) =>
        setInsights({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' }),
      )
  }, [sess.data, sets.data, dayExercises.data, history.data, allSessions.data, allDays.data, priorSession, exerciseStats])

  // Wait for critical queries before rendering.
  if (!sess.data || !sets.data || !dayExercises.data) {
    return (
      <Screen title="Summary">
        <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>
      </Screen>
    )
  }

  const duration =
    sess.data.ended_at && sess.data.started_at
      ? new Date(sess.data.ended_at).getTime() - new Date(sess.data.started_at).getTime()
      : 0
  const offApp = sess.data.background_ms ?? 0

  const muscleVolume = volumeByMuscleGroup(setsThisSession, dayExercises.data)
  const total = totalVolume(setsThisSession)

  const plannedSets = dayExercises.data.reduce((acc, e) => acc + e.default_sets, 0)
  const completedSets = setsThisSession.filter((s) => !s.is_warmup && !s.is_skipped).length
  const skippedExerciseIds = new Set(setsThisSession.filter((s) => s.is_skipped).map((s) => s.exercise_id))
  const skippedExercises = dayExercises.data.filter((e) => skippedExerciseIds.has(e.id))

  return (
    <Screen
      title="Complete"
      action={
        <Button variant="primary" onClick={onClose}>
          Back
        </Button>
      }
    >
      <Confetti />
      <div className="text-center py-4">
        <div className="text-4xl mb-2" aria-hidden>
          🎉
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Congratulations!</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          You crushed {completedSets} {completedSets === 1 ? 'set' : 'sets'} in {fmtDuration(duration)}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Duration" value={fmtDuration(duration)} />
        <Stat label="Off-app" value={fmtDuration(offApp)} />
        <Stat label="Volume" value={fmtVolume(total)} sub="lb" />
        <Stat label="Sets" value={`${completedSets}/${plannedSets}`} />
        <Stat label="Total rest" value={fmtDuration(totalRestMs(setsThisSession))} />
      </div>

      <Section title="Volume by muscle group">
        {muscleVolume.size === 0 ? (
          <Empty>No working sets logged.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {Array.from(muscleVolume.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([m, v]) => (
                <li key={m} className="flex justify-between text-sm">
                  <span>{m}</span>
                  <span className="text-[color:var(--color-muted)]">{fmtVolume(v)} lb</span>
                </li>
              ))}
          </ul>
        )}
      </Section>

      <Section title={`PRs (${prs.length})`}>
        {prs.length === 0 ? (
          <Empty>No new PRs.</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {prs.map((pr) => (
              <li key={pr.setId} className="flex justify-between">
                <span>{pr.kind === 'weight' ? 'Weight PR' : 'Reps PR'}</span>
                <span className="text-[color:var(--color-muted)]">
                  {fmtWeight(pr.weight)} × {pr.reps}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isAiFeaturesEnabled() && <InsightsSection state={insights} />}

      {skippedExercises.length > 0 && (
        <Section title="Skipped">
          <ul className="space-y-1 text-sm">
            {skippedExercises.map((e) => (
              <li key={e.id}>{e.name}</li>
            ))}
          </ul>
        </Section>
      )}

      {(swaps.data ?? []).length > 0 && (
        <Section title="Swaps">
          <ul className="space-y-1.5 text-sm">
            {(swaps.data ?? []).map((s) => {
              const planned = dayExercises.data?.find((e) => e.id === s.planned_exercise_id)
              return (
                <li key={s.id} className="flex justify-between">
                  <span className="text-[color:var(--color-muted)] line-through">{planned?.name ?? 'Unknown'}</span>
                  <span>{s.performed_exercise_name}</span>
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </Screen>
  )
}

function InsightsSection({ state }: { state: InsightsState }) {
  if (state.status === 'idle') return null

  if (state.status === 'insufficient') {
    return (
      <Section title="Insights">
        <Empty>Not enough data yet — come back after your next session of this workout.</Empty>
      </Section>
    )
  }

  if (state.status === 'loading') {
    return (
      <Section title="Insights">
        <div className="space-y-2 animate-pulse">
          <div className="h-4 rounded bg-[color:var(--color-border)] w-3/4" />
          <div className="mt-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 rounded bg-[color:var(--color-border)] w-1/3" />
                <div className="h-3 rounded bg-[color:var(--color-border)] w-1/5" />
              </div>
            ))}
          </div>
        </div>
      </Section>
    )
  }

  if (state.status === 'error') {
    return (
      <Section title="Insights">
        <Empty>Could not load insights: {state.message}</Empty>
      </Section>
    )
  }

  const { headline, rows, callout } = state.data

  return (
    <Section title="Insights">
      <p className="text-sm font-medium mb-3">{headline}</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.exerciseName} className="flex items-start justify-between gap-2 text-sm">
            <span className="text-[color:var(--color-text)]">{row.exerciseName}</span>
            <div className="text-right shrink-0">
              <span
                className={
                  row.direction === 'up'
                    ? 'text-green-400'
                    : row.direction === 'down'
                      ? 'text-red-400'
                      : 'text-[color:var(--color-muted)]'
                }
              >
                {row.delta}
              </span>
              {row.note && (
                <span className="block text-xs text-[color:var(--color-muted)]">{row.note}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {callout && (
        <p className="mt-3 text-xs text-[color:var(--color-muted)] border-t border-[color:var(--color-border)] pt-3">
          {callout}
        </p>
      )}
    </Section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      <div className="mt-1 text-xl font-semibold">
        {value}
        {sub && <span className="text-xs ml-1 text-[color:var(--color-muted)]">{sub}</span>}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2">{title}</h2>
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
        {children}
      </div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-[color:var(--color-muted)]">{children}</div>
}
