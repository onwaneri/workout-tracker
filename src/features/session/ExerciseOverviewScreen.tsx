import { fmtDuration } from '@/lib/format'
import type { Exercise } from '@/lib/supabase/database.types'
import type { ExerciseTarget } from '@/lib/stats/targets'

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  )
}

export function ExerciseOverviewScreen({
  exercises,
  setsByExercise,
  skippedIds,
  swapMap,
  targetByExercise,
  elapsed,
  totalSetsLogged,
  onSelectExercise,
  onDone,
  onCancel,
  endPending,
  cancelPending,
  endError,
}: {
  exercises: Exercise[]
  setsByExercise: Map<string, number>
  skippedIds: Set<string>
  swapMap: Map<string, { name: string; muscle_group: string; type: string }>
  targetByExercise?: Map<string, ExerciseTarget>
  elapsed: number
  totalSetsLogged: number
  onSelectExercise: (idx: number) => void
  onDone: () => void
  onCancel: () => void
  endPending: boolean
  cancelPending: boolean
  endError: string | null
}) {
  const nextIdx = exercises.findIndex(
    (e) => !skippedIds.has(e.id) && (setsByExercise.get(e.id) ?? 0) < e.default_sets,
  )

  return (
    <section style={{
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
      background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)',
    }}>
      <div style={{ padding: '6px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onCancel}
          disabled={cancelPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'var(--color-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer', minHeight: 44,
          }}
        >
          <XIcon /> Cancel
        </button>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
          <span style={{ color: 'var(--color-accent)' }}>●</span>{' '}
          {fmtDuration(elapsed)} · {totalSetsLogged} sets
        </div>

        <button
          onClick={onDone}
          disabled={endPending}
          style={{
            background: 'none', border: 'none', color: 'var(--color-text)',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
            fontWeight: 600, cursor: 'pointer', minHeight: 44, padding: '0 12px',
          }}
        >
          {endPending ? 'Saving…' : 'Done'}
        </button>
      </div>

      {endError && (
        <div style={{ margin: '0 20px', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, color: '#f87171' }}>
          {endError} — tap Done to retry.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 20px 120px' }}>
        {exercises.map((e, i) => {
          const logged = setsByExercise.get(e.id) ?? 0
          const skipped = skippedIds.has(e.id)
          const done = skipped || logged >= e.default_sets
          const isNext = i === nextIdx
          const displayName = swapMap.get(e.id)?.name ?? e.name
          const displayMuscle = swapMap.get(e.id)?.muscle_group ?? e.muscle_group

          return (
            <div key={e.id} style={{ marginBottom: 8 }}>
              {isNext && (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--color-accent)',
                  marginBottom: 8, marginTop: i > 0 ? 16 : 4,
                }}>
                  Up next
                </div>
              )}
              <button
                onClick={() => onSelectExercise(i)}
                style={{
                  display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center',
                  padding: '14px 16px', borderRadius: 16, cursor: 'pointer', gap: 14,
                  background: 'var(--color-surface)',
                  border: isNext && !done
                    ? '1px solid var(--color-accent)'
                    : '1px solid var(--color-border)',
                  opacity: done ? 0.55 : 1,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--color-accent)' : isNext ? 'var(--color-accent-dim)' : 'var(--color-border)',
                  color: '#fff',
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                }}>
                  {done ? <CheckIcon /> : i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600,
                    letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--color-text)',
                    textDecoration: skipped ? 'line-through' : 'none',
                  }}>
                    {displayName}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--color-muted)', marginTop: 3,
                  }}>
                    {displayMuscle} · {e.type}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                    {skipped ? 'skipped' : `${logged} / ${e.default_sets} sets`}
                  </div>
                  {(() => {
                    const t = targetByExercise?.get(e.id)
                    if (!t) return null
                    return (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-faint)', marginTop: 3 }}>
                        Target: {t.weight != null ? t.weight : 'BW'} {'\u00d7'} {t.reps ?? '—'}
                      </div>
                    )
                  })()}
                </div>

                <div style={{ color: done ? 'var(--color-accent)' : 'var(--color-muted)', flexShrink: 0 }}>
                  {done ? <CheckIcon /> : <ChevronIcon />}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
