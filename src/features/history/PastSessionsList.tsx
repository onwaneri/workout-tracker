import { useCallback, useMemo, useState } from 'react'
import { useSessions, useCancelSession } from '@/lib/queries/sessions'
import { useAllWorkoutDays } from '@/lib/queries/plans'
import { fmtDate, fmtDuration } from '@/lib/format'
import { SessionDetail } from './SessionDetail'

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  )
}

export function PastSessionsList() {
  const sessions = useSessions()
  const days = useAllWorkoutDays()
  const cancel = useCancelSession()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const dayNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of days.data ?? []) m.set(d.id, d.name)
    return m
  }, [days.data])

  const sessionItems = useMemo(() => {
    return (sessions.data ?? []).map((s) => {
      const durationMs =
        s.ended_at && s.started_at
          ? new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()
          : null
      return { ...s, durationMs }
    })
  }, [sessions.data])

  const onDelete = useCallback(
    (e: React.MouseEvent, id: string, label: string) => {
      e.stopPropagation()
      if (!window.confirm(`Delete ${label}? All sets from this session will be removed.`)) return
      cancel.mutate({ id })
    },
    [cancel],
  )

  const handleBack = useCallback(() => setSelectedId(null), [])

  if (sessions.isLoading) {
    return <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Loading…</p>
  }

  if (sessionItems.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>No sessions yet.</p>
  }

  if (selectedId) {
    const selected = sessionItems.find((s) => s.id === selectedId)
    const name = selected ? dayNameById.get(selected.workout_day_id) ?? 'Workout' : 'Workout'
    return <SessionDetail sessionId={selectedId} dayName={name} onBack={handleBack} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sessionItems.map((s, i) => {
        const name = dayNameById.get(s.workout_day_id) ?? 'Workout'
        const inProgress = !s.ended_at
        const label = `${name} · ${fmtDate(s.started_at)}`
        const startDate = new Date(s.started_at)
        const dayNum = startDate.getDate()
        const monthAbbr = startDate.toLocaleString('en-US', { month: 'short' })

        return (
          <div
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 1fr auto',
              gap: 14,
              padding: '14px 0',
              borderTop: i === 0 ? '1px solid var(--color-border)' : 'none',
              borderBottom: '1px solid var(--color-border)',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            {/* Date block */}
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
              <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
                {dayNum}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', marginTop: 2 }}>
                {monthAbbr}
              </div>
            </div>

            {/* Name + meta */}
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {name}
                {inProgress && (
                  <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-accent)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    ● Live
                  </span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', marginTop: 3 }}>
                {s.durationMs != null ? fmtDuration(s.durationMs) : fmtDate(s.started_at)}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={(e) => onDelete(e, s.id, label)}
                disabled={cancel.isPending}
                style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-danger)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
                  minHeight: 44, display: 'flex', alignItems: 'center',
                }}
              >
                Del
              </button>
              <span style={{ color: 'var(--color-muted)' }}><ArrowIcon /></span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
