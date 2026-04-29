import { useMemo } from 'react'
import { Screen } from '@/components/Screen'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { useSessions } from '@/lib/queries/sessions'
import { useAllExercises } from '@/lib/queries/exercises'
import { useGoals } from '@/lib/queries/goals'
import { plannedSessionsPerWeek, sessionsInWeek, consistencyStreakWeeks } from '@/lib/stats/consistency'
import { startOfISOWeek } from '@/lib/format'
import { supabase } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { volumeByMuscleGroup } from '@/lib/stats/volume'
import { fmtVolume } from '@/lib/format'
import { GoalsEditor } from '@/features/goals/GoalsEditor'

export function StatsView() {
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)
  const sessions = useSessions()
  const allEx = useAllExercises()
  const goals = useGoals()

  const weekStart = useMemo(() => startOfISOWeek(new Date()), [])
  const weekStartISO = weekStart.toISOString()

  // Fetch this week's session_sets for muscle-group volume.
  const weekSets = useQuery({
    queryKey: ['week-sets', weekStartISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_sets')
        .select('*')
        .gte('logged_at', weekStartISO)
      if (error) throw error
      return data ?? []
    },
  })

  if (!days.data || !sessions.data || !allEx.data) {
    return (
      <Screen title="Stats">
        <p className="text-sm text-[color:var(--color-muted)]">Loading…</p>
      </Screen>
    )
  }

  const plannedPerWeek = plannedSessionsPerWeek(days.data)
  const completedThisWeek = sessionsInWeek(sessions.data, weekStart).filter((s) => s.ended_at).length
  const streak = consistencyStreakWeeks(sessions.data, plannedPerWeek)
  const weekVolume = weekSets.data ? volumeByMuscleGroup(weekSets.data, allEx.data) : new Map<string, number>()
  const volumeGoals = (goals.data ?? []).filter((g) => g.muscle_group && g.weekly_volume_target)

  return (
    <Screen title="Stats">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="This week" value={`${completedThisWeek}/${plannedPerWeek}`} />
        <Stat label="Streak" value={`${streak}w`} />
      </div>

      <Section title="Weekly volume">
        {weekVolume.size === 0 ? (
          <Empty>No working sets logged yet this week.</Empty>
        ) : (
          <ul className="space-y-2">
            {Array.from(weekVolume.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([m, v]) => {
                const goal = volumeGoals.find((g) => g.muscle_group === m)
                const target = goal?.weekly_volume_target ?? 0
                const pct = target > 0 ? Math.min(100, (v / target) * 100) : 0
                return (
                  <li key={m}>
                    <div className="flex justify-between text-sm">
                      <span>{m}</span>
                      <span className="text-[color:var(--color-muted)]">
                        {fmtVolume(v)}
                        {target > 0 ? ` / ${fmtVolume(target)} lb` : ' lb'}
                      </span>
                    </div>
                    {target > 0 && (
                      <div className="mt-1 h-1.5 rounded-full bg-[color:var(--color-border)] overflow-hidden">
                        <div
                          className="h-full bg-[color:var(--color-accent)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
          </ul>
        )}
      </Section>

      <Section title="Goals">
        <GoalsEditor />
      </Section>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
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

