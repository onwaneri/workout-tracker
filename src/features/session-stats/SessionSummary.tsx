import { useMemo } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useSession, useSessionSets } from '@/lib/queries/sessions'
import { useExercises } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { totalVolume, volumeByMuscleGroup } from '@/lib/stats/volume'
import { detectPRs } from '@/lib/stats/prs'
import { fmtDuration, fmtVolume, fmtWeight } from '@/lib/format'

export function SessionSummary({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const sess = useSession(sessionId)
  const sets = useSessionSets(sessionId)
  const dayExercises = useExercises(sess.data?.workout_day_id)
  const allEx = useAllExercises()

  const lineageIds = useMemo(() => {
    if (!dayExercises.data || !allEx.data) return []
    const ids = new Set<string>()
    for (const e of dayExercises.data) for (const id of resolveExerciseLineage(e.id, allEx.data)) ids.add(id)
    return Array.from(ids)
  }, [dayExercises.data, allEx.data])

  const history = useExerciseHistory(lineageIds)

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

  const setsThisSession = sets.data
  const priorSets = (history.data ?? []).filter((s) => s.session_id !== sessionId)

  const prs = useMemo(() => detectPRs(setsThisSession, priorSets), [setsThisSession, priorSets])
  const muscleVolume = volumeByMuscleGroup(setsThisSession, dayExercises.data)
  const total = totalVolume(setsThisSession)

  const plannedSets = dayExercises.data.reduce((acc, e) => acc + e.default_sets, 0)
  const completedSets = setsThisSession.filter((s) => !s.is_warmup && !s.is_skipped).length
  const skippedExercises = dayExercises.data.filter((e) =>
    setsThisSession.some((s) => s.exercise_id === e.id && s.is_skipped),
  )

  return (
    <Screen
      title="Summary"
      action={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Duration" value={fmtDuration(duration)} />
        <Stat label="Off-app" value={fmtDuration(offApp)} />
        <Stat label="Volume" value={fmtVolume(total)} sub="lb" />
        <Stat label="Sets" value={`${completedSets}/${plannedSets}`} />
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

      {skippedExercises.length > 0 && (
        <Section title="Skipped">
          <ul className="space-y-1 text-sm">
            {skippedExercises.map((e) => (
              <li key={e.id}>{e.name}</li>
            ))}
          </ul>
        </Section>
      )}
    </Screen>
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

