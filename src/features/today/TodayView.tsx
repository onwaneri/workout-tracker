import { useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { useSessions, useStartSession } from '@/lib/queries/sessions'
import { useExercises } from '@/lib/queries/exercises'
import { useSession } from '@/features/session/sessionStore'
import { ActiveSessionView } from '@/features/session/ActiveSessionView'
import { pickNextWorkoutDay } from '@/features/session/nextSession'
import { restTargetSeconds } from '@/features/session/restTargets'
import { fmtDuration } from '@/lib/format'
import { SessionSummary } from '@/features/session-stats/SessionSummary'
import { useEnsurePlan } from '@/lib/seed/useEnsurePlan'
import { CycleStrip } from './CycleStrip'
import { PickAnotherView } from './PickAnotherView'

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

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)

  const activeDay = useMemo(() => {
    if (selectedDayId) return workoutDays.find((d) => d.id === selectedDayId) ?? nextDay
    return nextDay
  }, [selectedDayId, workoutDays, nextDay])

  const exercisesQuery = useExercises(activeDay?.id)

  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerBusyDayId, setPickerBusyDayId] = useState<string | null>(null)

  if (seed.status === 'seeding' || seed.status === 'idle') {
    return (
      <Screen title="Today">
        <p className="text-sm text-[color:var(--color-muted)]">Setting up your plan…</p>
      </Screen>
    )
  }
  if (seed.status === 'error') {
    return (
      <Screen title="Today">
        <p className="text-sm text-red-300">Could not initialize plan: {seed.error}</p>
        <p className="text-xs mt-3 text-[color:var(--color-muted)]">
          Make sure the database migrations in <code>supabase/migrations/</code> have been applied to your Supabase project.
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
        onPick={async (day) => {
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
        }}
      />
    )
  }

  if (!nextDay || !activeDay || !pv.data) {
    return (
      <Screen title="Today">
        <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>
      </Screen>
    )
  }

  const exs = exercisesQuery.data ?? []
  const estimatedMs = exs.reduce((acc, e) => acc + e.default_sets * restTargetSeconds(e.type) * 1000, 0)
  const isOffNext = activeDay.id !== nextDay.id

  const onStart = async () => {
    if (!pv.data || !activeDay) return
    const result = await startSession.mutateAsync({
      plan_version_id: pv.data.id,
      workout_day_id: activeDay.id,
    })
    session.setActive({ sessionId: result.id, workoutDayId: activeDay.id, startedAt: Date.now() })
  }

  return (
    <Screen title="Today">
      <div className="mb-4">
        <CycleStrip
          workoutDays={workoutDays}
          nextDayId={nextDay.id}
          selectedDayId={selectedDayId}
          onSelect={(offset, day) => setSelectedDayId(offset === 0 ? null : day.id)}
        />
        {isOffNext && (
          <button
            onClick={() => setSelectedDayId(null)}
            className="mt-2 text-xs text-[color:var(--color-muted)] underline"
          >
            Back to next
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
          {isOffNext ? 'Picked workout' : 'Next session'}
        </div>
        <div className="mt-1 text-xl font-semibold">{activeDay.name}</div>
        <div className="mt-1 text-xs text-[color:var(--color-muted)]">
          ~{fmtDuration(estimatedMs)} · {exs.length} exercises
        </div>
        <ul className="mt-4 space-y-1 text-sm">
          {exs.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-[color:var(--color-text)]/90">
              <span>{e.name}</span>
              <span className="text-xs text-[color:var(--color-muted)]">
                {e.default_sets}× · {e.type}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <Button size="lg" variant="primary" className="w-full" onClick={onStart} disabled={startSession.isPending}>
            {startSession.isPending ? 'Starting…' : 'Start session'}
          </Button>
        </div>
      </div>

      {sessions.data && sessions.data.length > 0 && (
        <div className="mt-5 text-xs text-[color:var(--color-muted)]">
          Last session: {new Date(sessions.data[0].started_at).toLocaleString()}
        </div>
      )}
    </Screen>
  )
}
