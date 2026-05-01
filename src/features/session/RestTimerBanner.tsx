import { useEffect, useState } from 'react'
import type { RestTimer } from './sessionStore'

const formatMMSS = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function RestTimerBanner({ timer, onSkip }: { timer: RestTimer; onSkip: () => void }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [timer.setId])

  const elapsedMs = now - timer.startedAt
  const targetMs = timer.targetSeconds * 1000
  const remainingMs = targetMs - elapsedMs
  const remainingSeconds = remainingMs / 1000
  const expired = remainingMs <= 0
  const pct = Math.min(100, Math.max(0, (elapsedMs / targetMs) * 100))

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 backdrop-blur"
    >
      <div
        className="h-1 bg-[color:var(--color-accent)] transition-[width] duration-300 ease-linear"
        style={{ width: `${pct}%` }}
      />
      <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-screen-sm mx-auto">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">
            {expired ? 'Rest done' : 'Resting'}
          </div>
          <div className="text-sm truncate">{timer.exerciseName}</div>
        </div>
        <div className={`text-2xl font-mono tabular-nums ${expired ? 'text-[color:var(--color-accent)]' : ''}`}>
          {expired ? '0:00' : formatMMSS(remainingSeconds)}
        </div>
        <button
          onClick={onSkip}
          className="min-h-[44px] px-4 rounded-lg border border-[color:var(--color-border)] text-sm font-medium hover:bg-white/5"
        >
          {expired ? 'Dismiss' : 'Skip rest'}
        </button>
      </div>
    </div>
  )
}
