import { useMemo, useState } from 'react'
import type { Session } from '@/lib/supabase/database.types'
import { workoutDaysSet, currentDayStreak, longestDayStreak } from '@/lib/stats/consistency'

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function CalendarHeatmap({ sessions }: { sessions: Session[] }) {
  const workoutSet = useMemo(() => workoutDaysSet(sessions), [sessions])
  const streak = useMemo(() => currentDayStreak(workoutSet), [workoutSet])
  const best = useMemo(() => longestDayStreak(workoutSet), [workoutSet])

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayKey = toDateKey(now.getFullYear(), now.getMonth(), now.getDate())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const isFutureMonth =
    viewYear > now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth > now.getMonth())

  return (
    <section>
      {/* Streak chips */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
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

      {/* Month navigation header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={prevMonth}
          style={{
            background: 'none', border: 'none', color: 'var(--color-muted)',
            cursor: 'pointer', padding: '4px 8px', minHeight: 36, fontSize: 16,
            display: 'flex', alignItems: 'center',
          }}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text)' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          disabled={isFutureMonth}
          style={{
            background: 'none', border: 'none',
            color: isFutureMonth ? 'var(--color-border)' : 'var(--color-muted)',
            cursor: isFutureMonth ? 'default' : 'pointer',
            padding: '4px 8px', minHeight: 36, fontSize: 16,
            display: 'flex', alignItems: 'center',
          }}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day grid: 7 columns, days 1-N in order */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const key = toDateKey(viewYear, viewMonth, day)
          const worked = workoutSet.has(key)
          const isToday = key === todayKey
          const isFutureDay =
            isFutureMonth ||
            (isCurrentMonth && day > now.getDate())

          return (
            <div
              key={day}
              style={{
                aspectRatio: '1',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                fontFeatureSettings: '"tnum"',
                background: worked
                  ? 'var(--color-accent)'
                  : 'var(--color-surface)',
                color: worked
                  ? 'var(--color-accent-ink)'
                  : isToday
                    ? 'var(--color-text)'
                    : 'var(--color-muted)',
                opacity: isFutureDay ? 0.35 : 1,
                outline: isToday && !worked ? '1px solid var(--color-accent-dim)' : 'none',
                fontWeight: isToday ? 600 : 400,
              }}
            >
              {day}
            </div>
          )
        })}
      </div>
    </section>
  )
}
