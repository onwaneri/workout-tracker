import type { EditedDay, EditedExercise } from './snapshotPlan'

export function DayEditor({
  day,
  dayNumber,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  day: EditedDay
  dayNumber: number
  onChange: (next: EditedDay) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove?: () => void
}) {
  const update = (patch: Partial<EditedDay>) => onChange({ ...day, ...patch })

  const addExercise = () => {
    const next: EditedExercise = {
      name: 'New exercise',
      muscle_group: '',
      type: 'isolation',
      default_sets: 3,
    }
    update({ exercises: [...day.exercises, next] })
  }

  const updateExercise = (idx: number, patch: Partial<EditedExercise>) => {
    update({ exercises: day.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)) })
  }

  const removeExercise = (idx: number) => {
    update({ exercises: day.exercises.filter((_, i) => i !== idx) })
  }

  const moveExercise = (from: number, to: number) => {
    if (to < 0 || to >= day.exercises.length) return
    const exs = day.exercises.slice()
    const [m] = exs.splice(from, 1)
    exs.splice(to, 0, m)
    update({ exercises: exs })
  }

  const inputBase: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    minWidth: 0,
  }

  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      overflow: 'hidden',
    }}>
      {/* Day header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent)', flexShrink: 0 }}>
          D{dayNumber}
        </span>
        <input
          value={day.name}
          onChange={(e) => update({ name: e.target.value })}
          style={{ ...inputBase, flex: 1, fontWeight: 600, fontSize: 15 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-muted)', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={day.is_rest}
            onChange={(e) => update({ is_rest: e.target.checked })}
            style={{ accentColor: 'var(--color-accent)' }}
          />
          Rest
        </label>
        <button onClick={onMoveUp} aria-label="Move day up" style={{ minHeight: 44, minWidth: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 16 }}>↑</button>
        <button onClick={onMoveDown} aria-label="Move day down" style={{ minHeight: 44, minWidth: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 16 }}>↓</button>
        {onRemove && (
          <button onClick={onRemove} aria-label="Remove day" style={{ minHeight: 44, minWidth: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 18 }}>×</button>
        )}
      </div>

      {/* Exercise list */}
      {!day.is_rest && (
        <>
          {day.exercises.length > 0 && (
            <div>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr 80px 90px 48px 72px',
                gap: 8,
                padding: '8px 16px',
                borderBottom: '1px solid var(--color-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-muted)',
              }}>
                <span>#</span>
                <span>Exercise</span>
                <span>Muscle</span>
                <span>Type</span>
                <span style={{ textAlign: 'center' }}>Sets</span>
                <span />
              </div>

              {day.exercises.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr 80px 90px 48px 72px',
                    gap: 8,
                    padding: '10px 16px',
                    alignItems: 'center',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', fontFeatureSettings: '"tnum"' }}>
                    {i + 1}
                  </span>
                  <input
                    value={e.name}
                    onChange={(ev) => updateExercise(i, { name: ev.target.value })}
                    style={{ ...inputBase, fontWeight: 500 }}
                  />
                  <input
                    value={e.muscle_group}
                    onChange={(ev) => updateExercise(i, { muscle_group: ev.target.value })}
                    placeholder="Group"
                    style={{ ...inputBase, fontSize: 12, color: 'var(--color-muted)' }}
                  />
                  <select
                    value={e.type}
                    onChange={(ev) => updateExercise(i, { type: ev.target.value as 'compound' | 'isolation' })}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--color-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      cursor: 'pointer',
                      minWidth: 0,
                    }}
                  >
                    <option value="compound">Compound</option>
                    <option value="isolation">Isolation</option>
                  </select>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={e.default_sets}
                    onChange={(ev) => updateExercise(i, { default_sets: Math.max(1, Number(ev.target.value) || 1) })}
                    aria-label="Default sets"
                    style={{ ...inputBase, width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontFeatureSettings: '"tnum"' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 0 }}>
                    <button onClick={() => moveExercise(i, i - 1)} aria-label="Move up" style={{ minHeight: 44, width: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 14 }}>↑</button>
                    <button onClick={() => moveExercise(i, i + 1)} aria-label="Move down" style={{ minHeight: 44, width: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 14 }}>↓</button>
                    <button onClick={() => removeExercise(i)} aria-label="Remove" style={{ minHeight: 44, width: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add exercise row */}
          <button
            type="button"
            onClick={addExercise}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderTop: '1px dashed var(--color-border)',
              color: 'var(--color-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            + Add exercise
          </button>
        </>
      )}
    </div>
  )
}
