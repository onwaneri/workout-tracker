import { useMemo } from 'react'
import { Screen } from '@/components/Screen'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { useSessions } from '@/lib/queries/sessions'
import { useAllExercises } from '@/lib/queries/exercises'
import { useGoals } from '@/lib/queries/goals'
import { plannedSessionsPerWeek, sessionsInWeek } from '@/lib/stats/consistency'
import { startOfISOWeek } from '@/lib/format'
import { supabase } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { volumeByMuscleGroup } from '@/lib/stats/volume'
import { avgRestMs } from '@/lib/stats/rest'
import { fmtDuration, fmtVolume } from '@/lib/format'
import { GoalsEditor } from '@/features/goals/GoalsEditor'
import { CalendarHeatmap } from './CalendarHeatmap'

export function StatsView() {
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)
  const sessions = useSessions()
  const allEx = useAllExercises()
  const goals = useGoals()

  const weekStart = useMemo(() => startOfISOWeek(new Date()), [])
  const weekStartISO = weekStart.toISOString()

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
      <Screen title="Stats" eyebrow="The shape of work">
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Loading…</p>
      </Screen>
    )
  }

  const plannedPerWeek = plannedSessionsPerWeek(days.data)
  const completedThisWeek = sessionsInWeek(sessions.data, weekStart).filter((s) => s.ended_at).length
  const totalCompleted = sessions.data.filter((s) => s.ended_at).length
  const weekVolume = weekSets.data ? volumeByMuscleGroup(weekSets.data, allEx.data) : new Map<string, number>()
  const weekAvgRest = weekSets.data ? avgRestMs(weekSets.data) : 0
  const volumeGoals = (goals.data ?? []).filter((g) => g.muscle_group && g.weekly_volume_target)
  const totalWeekVol = Array.from(weekVolume.values()).reduce((a, v) => a + v, 0)

  return (
    <Screen title="Stats" eyebrow="The shape of work">

      {/* Monthly heatmap */}
      <div style={{ marginBottom: 28 }}>
        <CalendarHeatmap sessions={sessions.data} />
      </div>

      {/* Stat chips */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0,
        padding: '18px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)',
        marginBottom: 28,
      }}>
        <StatChip
          label="This week"
          value={`${completedThisWeek}/${plannedPerWeek}`}
        />
        <StatChip
          label="All time"
          value={`${totalCompleted}`}
        />
        <StatChip
          label="Avg rest"
          value={weekAvgRest > 0 ? fmtDuration(weekAvgRest) : '—'}
        />
      </div>

      {/* Volume by muscle */}
      {weekVolume.size > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>
            Volume this week · {fmtVolume(totalWeekVol)} lb
          </div>
          <div style={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--color-surface)', overflow: 'hidden' }}>
            {Array.from(weekVolume.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([m, v], i) => {
                const goal = volumeGoals.find((g) => g.muscle_group === m)
                const target = goal?.weekly_volume_target ?? 0
                const pct = target > 0 ? Math.min(100, (v / target) * 100) : 0
                return (
                  <div key={m} style={{
                    padding: '14px 18px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: target > 0 ? 8 : 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{m}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', fontFeatureSettings: '"tnum"' }}>
                        {fmtVolume(v)}{target > 0 ? ` / ${fmtVolume(target)} lb` : ' lb'}
                      </span>
                    </div>
                    {target > 0 && (
                      <div style={{ height: 3, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--color-accent)', width: `${pct}%`, borderRadius: 999 }} />
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Goals */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>
          Goals
        </div>
        <div style={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 18 }}>
          <GoalsEditor />
        </div>
      </div>

    </Screen>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ paddingLeft: 0 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 500, marginTop: 4, fontFeatureSettings: '"tnum"' }}>
        {value}
      </div>
    </div>
  )
}
