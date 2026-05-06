import { useMemo } from 'react'
import type { Session } from '@/lib/supabase/database.types'
import { workoutDaysSet, currentDayStreak, longestDayStreak } from '@/lib/stats/consistency'

type MonthGrid = {
  label: string
  year: number
  month: number // 0-indexed
  // 2D array: weeks (rows) × 7 days (Mon=0 … Sun=6). null = no cell (before/after month).
  weeks: (Date | null)[][]
}

function buildMonthGrid(year: number, month: number): MonthGrid {
  const label = new Date(year, month, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Monday = 0 offset
  const startDow = (firstDay.getDay() + 6) % 7

  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = new Array(startDow).fill(null) as (Date | null)[]

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(new Date(year, month, day))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return { label, year, month, weeks }
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CalendarHeatmap({ sessions }: { sessions: Session[] }) {
  const workoutSet = useMemo(() => workoutDaysSet(sessions), [sessions])
  const streak = useMemo(() => currentDayStreak(workoutSet), [workoutSet])
  const best = useMemo(() => longestDayStreak(workoutSet), [workoutSet])

  const months = useMemo(() => {
    const today = new Date()
    const grids: MonthGrid[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      grids.push(buildMonthGrid(d.getFullYear(), d.getMonth()))
    }
    return grids // most recent first
  }, [])

  const todayKey = toDateKey(new Date())

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">Current streak</div>
          <div className="text-xl font-semibold">
            {streak} <span className="text-sm font-normal text-[color:var(--color-muted)]">days</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">Best</div>
          <div className="text-xl font-semibold">
            {best} <span className="text-sm font-normal text-[color:var(--color-muted)]">days</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-3 overflow-y-auto max-h-[480px]">
        <div className="space-y-4">
          {months.map((m) => (
            <div key={`${m.year}-${m.month}`}>
              <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)] mb-1">
                {m.label}
              </div>
              <div className="grid grid-cols-7 gap-[3px]">
                {m.weeks.flat().map((day, i) => {
                  if (!day) {
                    return <div key={i} className="aspect-square w-full" />
                  }
                  const key = toDateKey(day)
                  const isToday = key === todayKey
                  const worked = workoutSet.has(key)
                  const isFuture = day.getTime() > Date.now()

                  let cellClass = 'aspect-square w-full rounded-md'

                  if (worked) {
                    cellClass += ' bg-[color:var(--color-accent)]'
                  } else if (isToday) {
                    cellClass += ' ring-2 ring-inset ring-[color:var(--color-accent)]/60 bg-white/10'
                  } else if (isFuture) {
                    cellClass += ' bg-white/5'
                  } else {
                    cellClass += ' bg-white/10'
                  }

                  return <div key={i} className={cellClass} />
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
