import { useEffect, useState } from 'react'
import type { RestTimer } from './sessionStore'

const formatMMSS = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const R = 110
const CIRCUMFERENCE = 2 * Math.PI * R

export function RestTimerBanner({
  timer,
  onSkip,
  onAddTime,
}: {
  timer: RestTimer
  onSkip: () => void
  onAddTime: (extraSeconds: number) => void
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const elapsedMs = now - timer.startedAt
  const targetMs = timer.targetSeconds * 1000
  const remainingMs = targetMs - elapsedMs
  const remainingSeconds = remainingMs / 1000
  const expired = remainingMs <= 0
  const pct = Math.min(1, Math.max(0, elapsedMs / targetMs))
  const dashOffset = CIRCUMFERENCE * (1 - pct)

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'rgba(13, 12, 10, 0.82)',
      }}
    >
      {/* SVG ring */}
      <div style={{ position: 'relative', width: 264, height: 264, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          width={264}
          height={264}
          viewBox="0 0 264 264"
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx={132}
            cy={132}
            r={R}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={6}
          />
          {/* Progress arc */}
          <circle
            cx={132}
            cy={132}
            r={R}
            fill="none"
            stroke={expired ? 'var(--color-accent)' : 'var(--color-accent)'}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>

        {/* Center content */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 52,
              fontWeight: 600,
              letterSpacing: '-0.04em',
              fontFeatureSettings: '"tnum"',
              color: expired ? 'var(--color-accent)' : 'var(--color-text)',
              lineHeight: 1,
            }}
          >
            {expired ? '0:00' : formatMMSS(remainingSeconds)}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              marginTop: 6,
            }}
          >
            {expired ? 'Rest done' : 'Resting'}
          </div>
        </div>
      </div>

      {/* Exercise label */}
      <div style={{ textAlign: 'center', maxWidth: 240 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          {timer.exerciseName}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => onAddTime(30)}
          style={{
            minHeight: 48,
            padding: '0 22px',
            borderRadius: 24,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-hi)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          +30s
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            minHeight: 48,
            padding: '0 22px',
            borderRadius: 24,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-hi)',
            color: 'var(--color-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          {expired ? 'Dismiss' : 'Skip rest'}
        </button>
      </div>
    </div>
  )
}
