import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import type { SessionSet } from '@/lib/supabase/database.types'

type Point = { date: string; topSet: number }

export function ExerciseChart({ sets }: { sets: SessionSet[] }) {
  const points = useMemo<Point[]>(() => {
    const bySession = new Map<string, SessionSet[]>()
    for (const s of sets) {
      if (s.is_warmup || s.is_skipped) continue
      const list = bySession.get(s.session_id) ?? []
      list.push(s)
      bySession.set(s.session_id, list)
    }
    const out: Point[] = []
    for (const [, list] of bySession) {
      const top = list.reduce((m, s) => Math.max(m, s.weight ?? 0), 0)
      const date = list.reduce((min, s) => (s.logged_at < min ? s.logged_at : min), list[0].logged_at)
      out.push({ date: date.slice(0, 10), topSet: top })
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [sets])

  if (points.length === 0) {
    return <div className="text-sm text-[color:var(--color-muted)]">Not enough data for a chart yet.</div>
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#222730" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#8a919c" fontSize={11} />
          <YAxis stroke="#8a919c" fontSize={11} />
          <Tooltip
            contentStyle={{ background: '#14171c', border: '1px solid #222730', fontSize: 12 }}
            labelStyle={{ color: '#8a919c' }}
          />
          <Line type="monotone" dataKey="topSet" stroke="#8b5cf6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
