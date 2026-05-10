import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession, useSessionSets, useSessions } from '@/lib/queries/sessions'
import { useExercises } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { useAllWorkoutDays } from '@/lib/queries/plans'
import { useSessionSwaps } from '@/lib/queries/swaps'
import { totalVolume } from '@/lib/stats/volume'
import { avgRestMs } from '@/lib/stats/rest'
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

function TrophyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4ZM4 5h3v3a3 3 0 0 1-3-3ZM20 5h-3v3a3 3 0 0 0 3-3ZM10 14v3h4v-3M8 21h8"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  )
}

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

  const exerciseStats = useMemo(() => {
    if (!dayExercises.data || !sets.data || !history.data || !priorSession) return null
    const priorSessionSets = history.data.filter((s) => s.session_id === priorSession.id)
    return dayExercises.data.map((e) => {
      const curSets = sets.data.filter((s) => s.exercise_id === e.id && !s.is_warmup && !s.is_skipped)
      const priSets = priorSessionSets.filter((s) => s.exercise_id === e.id && !s.is_warmup && !s.is_skipped)
      const stats = (arr: typeof curSets) => ({
        bestWeight: arr.reduce<number | null>((m, s) => (s.weight != null ? Math.max(m ?? 0, s.weight) : m), null),
        totalReps: arr.reduce((s, r) => s + (r.reps ?? 0), 0),
        avgRpe: arr.filter((s) => s.rpe != null).length > 0
          ? arr.reduce((s, r) => s + (r.rpe ?? 0), 0) / arr.filter((s) => s.rpe != null).length
          : null,
        workingSets: arr.length,
      })
      return { name: e.name, muscle_group: e.muscle_group, current: stats(curSets), prior: stats(priSets) }
    })
  }, [dayExercises.data, sets.data, history.data, priorSession])

  const [insights, setInsights] = useState<InsightsState>({ status: 'idle' })
  const firedRef = useRef(false)

  useEffect(() => {
    if (!isAiFeaturesEnabled()) return
    if (firedRef.current) return
    if (!sess.data || !sets.data || !dayExercises.data || !history.data || !allSessions.data || !allDays.data) return
    firedRef.current = true
    if (!priorSession || !exerciseStats || exerciseStats.length === 0) {
      setInsights({ status: 'insufficient' }); return
    }
    const dayName = allDays.data.find((d) => d.id === sess.data!.workout_day_id)?.name ?? 'Workout'
    setInsights({ status: 'loading' })
    requestSessionInsights({ workoutDayName: dayName, exercises: exerciseStats })
      .then((data) => setInsights({ status: 'ok', data }))
      .catch((err: unknown) => setInsights({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' }))
  }, [sess.data, sets.data, dayExercises.data, history.data, allSessions.data, allDays.data, priorSession, exerciseStats])

  if (!sess.data || !sets.data || !dayExercises.data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--color-bg)', color: 'var(--color-text)', padding: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Loading…</p>
      </div>
    )
  }

  const duration =
    sess.data.ended_at && sess.data.started_at
      ? new Date(sess.data.ended_at).getTime() - new Date(sess.data.started_at).getTime()
      : 0
  const offApp = sess.data.background_ms ?? 0
  const total = totalVolume(setsThisSession)
  const plannedSets = dayExercises.data.reduce((acc, e) => acc + e.default_sets, 0)
  const completedSets = setsThisSession.filter((s) => !s.is_warmup && !s.is_skipped).length
  const skippedExerciseIds = new Set(setsThisSession.filter((s) => s.is_skipped).map((s) => s.exercise_id))
  const skippedExercises = dayExercises.data.filter((e) => skippedExerciseIds.has(e.id))
  const dayName = allDays.data?.find((d) => d.id === sess.data!.workout_day_id)?.name ?? 'Workout'

  const topPr = prs[0] ?? null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <Confetti />

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 12px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Workout complete
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}>
          <XIcon />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 24px 120px' }}>

        {/* Hero headline */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: prs.length > 0 ? 'var(--color-accent)' : 'var(--color-success)', textTransform: 'uppercase' }}>
          {prs.length > 0 ? `+${prs.length} PR` : '✓ Complete'} · {completedSets}/{plannedSets} sets
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 600, letterSpacing: '-0.04em', margin: '6px 0 0', lineHeight: 0.95 }}>
          {dayName.split(' · ')[0]},<br />banked.
        </h1>
        <p style={{ marginTop: 14, fontSize: 14, color: 'var(--color-muted)' }}>
          {completedSets} {completedSets === 1 ? 'set' : 'sets'} in {fmtDuration(duration)}.
          {prs.length > 0 && ' New personal best — keep it up.'}
        </p>

        {/* PR card */}
        {topPr && (
          <div style={{
            marginTop: 24, padding: 20, borderRadius: 20,
            background: 'var(--color-accent)', color: 'var(--color-accent-ink)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>
                  New personal record
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginTop: 4, lineHeight: 1.1 }}>
                  {dayExercises.data.find(e => setsThisSession.find(s => s.id === topPr.setId && s.exercise_id === e.id))?.name ?? 'Top set'}
                </div>
              </div>
              <TrophyIcon />
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 52, fontWeight: 500, letterSpacing: '-0.04em', fontFeatureSettings: '"tnum"' }}>
                {fmtWeight(topPr.weight)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, opacity: 0.7 }}>
                lb × {topPr.reps}
              </span>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div style={{
          marginTop: 20, padding: '20px 22px', borderRadius: 20,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 18, columnGap: 18,
        }}>
          <StatChip label="Duration" value={fmtDuration(duration)} />
          <StatChip label="Volume" value={fmtVolume(total) + ' lb'} />
          <StatChip label="Sets" value={`${completedSets} / ${plannedSets}`} />
          <StatChip label="Avg RPE" value={
            (() => {
              const rpeSets = setsThisSession.filter(s => s.rpe != null && !s.is_warmup && !s.is_skipped)
              if (!rpeSets.length) return '—'
              const avg = rpeSets.reduce((a, s) => a + s.rpe!, 0) / rpeSets.length
              return avg.toFixed(1)
            })()
          } />
          <StatChip label="Off-app" value={fmtDuration(offApp)} />
          <StatChip label="Avg rest" value={fmtDuration(avgRestMs(setsThisSession))} />
        </div>

        {/* All PRs */}
        {prs.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 10 }}>
              All PRs ({prs.length})
            </div>
            {prs.map((pr, i) => {
              const ex = dayExercises.data?.find(e => setsThisSession.find(s => s.id === pr.setId && s.exercise_id === e.id))
              return (
                <div key={pr.setId} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '12px 0',
                  borderTop: i === 0 ? '1px solid var(--color-border)' : 'none',
                  borderBottom: '1px solid var(--color-border)', alignItems: 'center',
                }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{ex?.name ?? (pr.kind === 'weight' ? 'Weight PR' : 'Reps PR')}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, fontFeatureSettings: '"tnum"' }}>{fmtWeight(pr.weight)}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)' }}>× {pr.reps}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* AI Insights */}
        {isAiFeaturesEnabled() && <InsightsSection state={insights} />}

        {/* Skipped */}
        {skippedExercises.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 10 }}>
              Skipped
            </div>
            <div style={{ borderRadius: 14, border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '4px 0' }}>
              {skippedExercises.map((e, i) => (
                <div key={e.id} style={{ padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', fontSize: 14 }}>
                  {e.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Swaps */}
        {(swaps.data ?? []).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 10 }}>
              Swaps
            </div>
            <div style={{ borderRadius: 14, border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '4px 0' }}>
              {(swaps.data ?? []).map((s, i) => {
                const planned = dayExercises.data?.find((e) => e.id === s.planned_exercise_id)
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', fontSize: 14 }}>
                    <span style={{ color: 'var(--color-muted)', textDecoration: 'line-through' }}>{planned?.name ?? 'Unknown'}</span>
                    <span>{s.performed_exercise_name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 32, width: '100%', padding: 18, borderRadius: 16, border: 'none',
            background: 'var(--color-text)', color: 'var(--color-bg)',
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Save and close →
        </button>
      </div>
    </section>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--color-text)', marginTop: 2, fontFeatureSettings: '"tnum"' }}>
        {value}
      </div>
    </div>
  )
}

function InsightsSection({ state }: { state: InsightsState }) {
  if (state.status === 'idle') return null

  const content = () => {
    if (state.status === 'insufficient') return <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Not enough data yet — come back after your next session.</p>
    if (state.status === 'loading') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ height: 12, borderRadius: 6, background: 'var(--color-border)', width: '45%' }} />
            <div style={{ height: 12, borderRadius: 6, background: 'var(--color-border)', width: '20%' }} />
          </div>
        ))}
      </div>
    )
    if (state.status === 'error') return <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{state.message}</p>
    const { headline, rows, callout } = state.data
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{headline}</p>
        {rows.map((row) => (
          <div key={row.exerciseName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, fontSize: 13 }}>
            <span>{row.exerciseName}</span>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ color: row.direction === 'up' ? 'var(--color-success)' : row.direction === 'down' ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                {row.delta}
              </span>
              {row.note && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{row.note}</div>}
            </div>
          </div>
        ))}
        {callout && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>{callout}</p>}
      </>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>
        Insights
      </div>
      <div style={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '16px 18px' }}>
        {content()}
      </div>
    </div>
  )
}
