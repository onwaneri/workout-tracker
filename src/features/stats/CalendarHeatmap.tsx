import { useMemo } from 'react'
import type { Session } from '@/lib/supabase/database.types'
import { workoutDaysSet, currentDayStreak, longestDayStreak } from '@/lib/stats/consistency'

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CalendarHeatmap({ sessions }: { sessions: Session[] }) {
  const workoutSet = useMemo(() => workoutDaysSet(sessions), [sessions])
  const streak = useMemo(() => currentDayStreak(workoutSet), [workoutSet])
  const best = useMemo(() => longestDayStreak(workoutSet), [workoutSet])

  // Build 13-week grid (most recent week on the right)
  const cells = useMemo(() => {
    const today = new Date()
    const result: { date: Date; key: string }[][] = []
    // Sunday of 13 weeks ago
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - today.getDay() - 13 * 7)

    for (let w = 0; w < 13; w++) {
      const week: { date: Date; key: string }[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + w * 7 + d)
        week.push({ date, key: toDateKey(date) })
      }
      result.push(week)
    }
    return result
  }, [])

  const todayKey = toDateKey(new Date())

  return (
    <section>
      {/* Streak chips */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
            Streak
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: 'var(--color-accent)', marginTop: 2, fontFeatureSettings: '"tnum"' }}>
            {streak}<span style={{ fontSize: 14, color: 'var(--color-muted)', marginLeft: 2 }}>d</span>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
            Best
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, marginTop: 2, fontFeatureSettings: '"tnum"' }}>
            {best}<span style={{ fontSize: 14, color: 'var(--color-muted)', marginLeft: 2 }}>d</span>
          </div>
        </div>
      </div>

      {/* 13-week grid: columns = weeks, rows = days */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(13, 1fr)`, gap: 4 }}>
        {cells.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {week.map(({ date, key }) => {
              const worked = workoutSet.has(key)
              const isToday = key === todayKey
              const isFuture = date.getTime() > Date.now() + 86400000

              return (
                <div
                  key={key}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 3,
                    background: worked
                      ? 'var(--color-accent)'
                      : isToday
                        ? 'var(--color-surface-hi)'
                        : isFuture
                          ? 'var(--color-surface)'
                          : 'var(--color-surface)',
                    opacity: worked ? 0.85 : isFuture ? 0.3 : 0.6,
                    outline: isToday ? '1px solid var(--color-accent-dim)' : 'none',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', alignItems: 'center' }}>
        <span>less</span>
        {[0.15, 0.4, 0.65, 0.85].map((o, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-accent)', opacity: o }} />
        ))}
        <span>more</span>
      </div>
    </section>
  )
}
