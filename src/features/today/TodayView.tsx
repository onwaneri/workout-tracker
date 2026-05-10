import { useCallback, useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { useSessions, useStartSession } from '@/lib/queries/sessions'
import { useExercises } from '@/lib/queries/exercises'
import { useSession } from '@/features/session/sessionStore'
import { ActiveSessionView } from '@/features/session/ActiveSessionView'
import { pickNextWorkoutDay, pickNextDay, completedToday } from '@/features/session/nextSession'
import { restTargetSeconds } from '@/features/session/restTargets'
import { fmtDuration } from '@/lib/format'
import { SessionSummary } from '@/features/session-stats/SessionSummary'
import { useEnsurePlan } from '@/lib/seed/useEnsurePlan'
import { CycleStrip } from './CycleStrip'
import { PickAnotherView } from './PickAnotherView'
import type { WorkoutDay } from '@/lib/supabase/database.types'

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4l13 8-13 8V4Z"/>
    </svg>
  )
}

function todayEyebrow() {
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { weekday: 'long' })
  const md = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return `${day} · ${md}`
}

export function TodayView() {
  const seed = useEnsurePlan()
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)
  const sessions = useSessions()
  const session = useSession()
  const startSession = useStartSession()

  const workoutDays = useMemo(
    () => (days.data ? [...days.data].filter((d) => !d.is_rest).sort((a, b) => a.order_index - b.order_index) : []),
    [days.data],
  )

  const nextDay = useMemo(
    () => (days.data && sessions.data ? pickNextWorkoutDay(days.data, sessions.data) : null),
    [days.data, sessions.data],
  )

  const doneForToday = useMemo(
    () => (sessions.data ? completedToday(sessions.data) : false),
    [sessions.data],
  )

  const isRestDay = useMemo(
    () =>
      !doneForToday &&
      !!days.data &&
      !!sessions.data &&
      (pickNextDay(days.data, sessions.data)?.is_rest ?? false),
    [doneForToday, days.data, sessions.data],
  )

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  const activeDay = useMemo(() => {
    if (selectedDayId) return workoutDays.find((d) => d.id === selectedDayId) ?? nextDay
    return nextDay
  }, [selectedDayId, workoutDays, nextDay])

  const exercisesQuery = useExercises(activeDay?.id)

  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerBusyDayId, setPickerBusyDayId] = useState<string | null>(null)

  const handleSelectDay = useCallback((offset: number, day: WorkoutDay) => {
    setSelectedDayId(offset === 0 ? null : day.id)
  }, [])

  const handlePickAnother = useCallback(
    async (day: WorkoutDay) => {
      if (!pv.data) return
      setPickerBusyDayId(day.id)
      try {
        const result = await startSession.mutateAsync({
          plan_version_id: pv.data.id,
          workout_day_id: day.id,
        })
        session.setActive({ sessionId: result.id, workoutDayId: day.id, startedAt: Date.now() })
        setShowPicker(false)
        setPickerBusyDayId(null)
      } catch {
        setPickerBusyDayId(null)
      }
    },
    [pv.data, startSession, session],
  )

  const handleStart = useCallback(async () => {
    if (!pv.data || !activeDay) return
    const result = await startSession.mutateAsync({
      plan_version_id: pv.data.id,
      workout_day_id: activeDay.id,
    })
    session.setActive({ sessionId: result.id, workoutDayId: activeDay.id, startedAt: Date.now() })
  }, [pv.data, activeDay, startSession, session])

  if (seed.status === 'seeding' || seed.status === 'idle') {
    return (
      <Screen title="Setting up…" eyebrow={todayEyebrow()}>
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Initializing your plan…</p>
      </Screen>
    )
  }
  if (seed.status === 'error') {
    return (
      <Screen title="Error" eyebrow={todayEyebrow()}>
        <p style={{ fontSize: 14, color: 'var(--color-danger)' }}>Could not initialize plan: {seed.error}</p>
        <p style={{ fontSize: 12, marginTop: 12, color: 'var(--color-muted)' }}>
          Make sure the database migrations in <code>supabase/migrations/</code> have been applied.
        </p>
      </Screen>
    )
  }

  if (session.activeSessionId && !completedSessionId) {
    return (
      <ActiveSessionView
        onComplete={() => {
          const id = session.activeSessionId
          session.clear()
          if (id) setCompletedSessionId(id)
        }}
        onCancel={() => {
          session.clear()
          setCompletedSessionId(null)
        }}
      />
    )
  }

  if (completedSessionId) {
    return (
      <SessionSummary
        sessionId={completedSessionId}
        onClose={() => {
          setCompletedSessionId(null)
          setShowPicker(true)
        }}
      />
    )
  }

  if (showPicker) {
    return (
      <PickAnotherView
        busyDayId={pickerBusyDayId}
        onExit={() => {
          setShowPicker(false)
          setPickerBusyDayId(null)
        }}
        onPick={handlePickAnother}
      />
    )
  }

  if (!nextDay || !activeDay || !pv.data) {
    return (
      <Screen title="Loading…" eyebrow={todayEyebrow()}>
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Loading…</p>
      </Screen>
    )
  }

  const exs = exercisesQuery.data ?? []
  const estimatedMs = exs.reduce((acc, e) => acc + e.default_sets * restTargetSeconds(e.type) * 1000, 0)
  const isOffNext = activeDay.id !== nextDay.id

  const screenTitle = isRestDay && !isOffNext
    ? 'Rest day.'
    : doneForToday && !isOffNext
    ? 'All done.'
    : isOffNext
    ? activeDay.name
    : activeDay.name.split('·')[0].trim().toLowerCase() + '.'

  return (
    <Screen title={screenTitle} eyebrow={todayEyebrow()}>
      <div className="mb-5">
        <CycleStrip
          workoutDays={workoutDays}
          nextDayId={nextDay.id}
          selectedDayId={selectedDayId}
          onSelect={handleSelectDay}
        />
        {isOffNext && (
          <button
            onClick={() => setSelectedDayId(null)}
            style={{ marginTop: 8, fontSize: 12, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', textDecoration: 'underline' }}
          >
            ← Back to next
          </button>
        )}
      </div>

      {/* Hero card */}
      <div style={{
        borderRadius: 22,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: '22px 22px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Accent glow */}
        <div style={{
          position: 'absolute', right: -20, top: -20, width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, var(--color-accent-soft), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {isRestDay && !isOffNext ? (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
              Rest day
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: 'var(--color-muted)' }}>
              Take it easy — recovery is part of the program.
            </div>
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Up next</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 6 }}>{activeDay.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                ~{fmtDuration(estimatedMs)} · {exs.length} exercises
              </div>
              <ExerciseList exs={exs} />
            </div>
            <div style={{ marginTop: 20 }}>
              <Button size="lg" variant="secondary" className="w-full" onClick={handleStart} disabled={startSession.isPending}>
                {startSession.isPending ? 'Starting…' : 'Work out anyway'}
              </Button>
            </div>
          </>
        ) : doneForToday && !isOffNext ? (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-success)' }}>
              Done for today
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: 'var(--color-muted)' }}>
              Nice work. Rest up and come back tomorrow.
            </div>
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>Up next</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 6 }}>{activeDay.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                ~{fmtDuration(estimatedMs)} · {exs.length} exercises
              </div>
              <ExerciseList exs={exs} />
            </div>
            <div style={{ marginTop: 20 }}>
              <Button size="lg" variant="secondary" className="w-full" onClick={handleStart} disabled={startSession.isPending}>
                {startSession.isPending ? 'Starting…' : 'Start anyway'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Header row with play button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
                  {isOffNext ? 'Picked workout' : 'Up next'}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', marginTop: 8, lineHeight: 1.1 }}>
                  {activeDay.name.includes(' · ')
                    ? <>
                        {activeDay.name.split(' · ')[0]}<br />
                        <span style={{ opacity: 0.7, fontSize: 18 }}>{activeDay.name.split(' · ')[1]}</span>
                      </>
                    : activeDay.name}
                </div>
              </div>
              <button
                onClick={handleStart}
                disabled={startSession.isPending}
                style={{
                  width: 52, height: 52, borderRadius: 16, border: 'none',
                  background: 'var(--color-accent)', color: 'var(--color-accent-ink)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  opacity: startSession.isPending ? 0.5 : 1,
                }}
                aria-label="Start session"
              >
                <PlayIcon />
              </button>
            </div>

            {/* Stats strip */}
            <div style={{ display: 'flex', gap: 22, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
              <MiniStat label="Time" value={`~${fmtDuration(estimatedMs)}`} />
              <MiniStat label="Sets" value={String(exs.reduce((a, e) => a + e.default_sets, 0))} />
              <MiniStat label="Exercises" value={String(exs.length)} />
            </div>

            {/* Exercise list */}
            {exs.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 10 }}>
                  The plan
                </div>
                <ExerciseList exs={exs} numbered />
              </div>
            )}
          </>
        )}
      </div>

      {sessions.data && sessions.data.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--color-faint)', fontFamily: 'var(--font-mono)' }}>
          last session · {new Date(sessions.data[0].started_at).toLocaleString()}
        </div>
      )}
    </Screen>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--color-text)', marginTop: 2, fontFeatureSettings: '"tnum"' }}>
        {value}
      </div>
    </div>
  )
}

function ExerciseList({ exs, numbered }: { exs: { id: string; name: string; default_sets: number; type: string }[]; numbered?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {exs.map((e, i) => (
        <div key={e.id} style={{
          display: 'grid',
          gridTemplateColumns: numbered ? '28px 1fr auto' : '1fr auto',
          gap: 12,
          alignItems: 'center',
          paddingTop: 12,
          paddingBottom: 12,
          borderTop: `1px solid var(--color-border)`,
        }}>
          {numbered && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-faint)', fontFeatureSettings: '"tnum"' }}>
              {String(i + 1).padStart(2, '0')}
            </div>
          )}
          <div style={{ fontWeight: 500, fontSize: 14 }}>{e.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', fontFeatureSettings: '"tnum"' }}>
            {e.default_sets}× · {e.type}
          </div>
        </div>
      ))}
    </div>
  )
}
