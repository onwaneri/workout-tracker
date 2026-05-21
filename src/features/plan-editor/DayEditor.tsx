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
      equipment: 'barbell',
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
        <button onClick={onMoveUp} aria-label="Move day up" style={{ minHeight: 44, minWidth: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 16 }}>↑</button>
        <button onClick={onMoveDown} aria-label="Move day down" style={{ minHeight: 44, minWidth: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 16 }}>↓</button>
        {onRemove && (
          <button onClick={onRemove} aria-label="Remove day" style={{ minHeight: 44, minWidth: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 18 }}>×</button>
        )}
      </div>

      {/* Exercise list */}
      {!day.is_rest && (
        <>
          {day.exercises.length > 0 && (
            <div>
              {day.exercises.map((e, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 16px',
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {/* Row 1: index + name + action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', fontFeatureSettings: '"tnum"', flexShrink: 0, width: 20 }}>
                      {i + 1}
                    </span>
                    <input
                      value={e.name}
                      onChange={(ev) => updateExercise(i, { name: ev.target.value })}
                      placeholder="Exercise name"
                      style={{ ...inputBase, fontWeight: 500, flex: 1 }}
                    />
                    <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                      <button onClick={() => moveExercise(i, i - 1)} aria-label="Move up" style={{ minHeight: 44, minWidth: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 14 }}>↑</button>
                      <button onClick={() => moveExercise(i, i + 1)} aria-label="Move down" style={{ minHeight: 44, minWidth: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)', fontSize: 14 }}>↓</button>
                      <button onClick={() => removeExercise(i)} aria-label="Remove" style={{ minHeight: 44, minWidth: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16 }}>×</button>
                    </div>
                  </div>
                  {/* Row 2: muscle group + type + sets */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 28 }}>
                    <input
                      value={e.muscle_group}
                      onChange={(ev) => updateExercise(i, { muscle_group: ev.target.value })}
                      placeholder="Muscle group"
                      style={{ ...inputBase, fontSize: 12, color: 'var(--color-muted)', flex: 1 }}
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
                        flexShrink: 0,
                      }}
                    >
                      <option value="compound">Compound</option>
                      <option value="isolation">Isolation</option>
                    </select>
                    <select
                      value={e.equipment}
                      onChange={(ev) => updateExercise(i, { equipment: ev.target.value as 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--color-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        cursor: 'pointer',
                        minWidth: 0,
                        flexShrink: 0,
                      }}
                    >
                      <option value="barbell">Barbell</option>
                      <option value="dumbbell">Dumbbell</option>
                      <option value="machine">Machine</option>
                      <option value="cable">Cable</option>
                      <option value="bodyweight">Bodyweight</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sets</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={e.default_sets}
                        onChange={(ev) => updateExercise(i, { default_sets: Math.max(1, Number(ev.target.value) || 1) })}
                        aria-label="Default sets"
                        style={{ ...inputBase, width: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontFeatureSettings: '"tnum"' }}
                      />
                    </div>
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
