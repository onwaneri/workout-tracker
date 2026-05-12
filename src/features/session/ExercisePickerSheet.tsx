import { BottomSheet } from '@/components/BottomSheet'
import type { Exercise } from '@/lib/supabase/database.types'

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6"/>
    </svg>
  )
}

export function ExercisePickerSheet({
  open,
  onClose,
  exercises,
  currentExIdx,
  setsByExercise,
  skippedIds,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  exercises: Exercise[]
  currentExIdx: number
  setsByExercise: Map<string, number>
  skippedIds: Set<string>
  onSelect: (idx: number) => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12,
      }}>
        Exercises
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {exercises.map((e, i) => {
          const logged = setsByExercise.get(e.id) ?? 0
          const skipped = skippedIds.has(e.id)
          const done = skipped || logged >= e.default_sets
          const active = i === currentExIdx

          return (
            <button
              key={e.id}
              onClick={() => { onSelect(i); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12,
                border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
                background: active ? 'rgba(255,255,255,0.04)' : 'var(--color-surface)',
                cursor: 'pointer', minHeight: 44,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  background: done ? 'var(--color-accent)' : active ? 'var(--color-accent-dim)' : 'var(--color-border)',
                  color: done || active ? '#fff' : 'var(--color-muted)',
                }}>
                  {done ? <CheckIcon /> : i + 1}
                </span>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 15,
                  color: skipped ? 'var(--color-muted)' : 'var(--color-text)',
                  textDecoration: skipped ? 'line-through' : 'none',
                }}>
                  {e.name}
                </span>
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', flexShrink: 0, marginLeft: 8,
              }}>
                {skipped ? 'skipped' : `${logged}/${e.default_sets}`}
              </span>
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
