import { Button } from '@/components/Button'
import type { EditedDay, EditedExercise } from './snapshotPlan'

export function DayEditor({
  day,
  dayNumber,
  onChange,
  onMoveUp,
  onMoveDown,
}: {
  day: EditedDay
  dayNumber: number
  onChange: (next: EditedDay) => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const update = (patch: Partial<EditedDay>) => onChange({ ...day, ...patch })

  const addExercise = () => {
    const next: EditedExercise = {
      name: 'New exercise',
      muscle_group: '',
      type: 'isolation',
      default_sets: 2,
    }
    update({ exercises: [...day.exercises, next] })
  }

  const updateExercise = (idx: number, patch: Partial<EditedExercise>) => {
    update({ exercises: day.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)) })
  }

  const removeExercise = (idx: number) => {
    update({
      exercises: day.exercises.filter((_, i) => i !== idx),
    })
  }

  const moveExercise = (from: number, to: number) => {
    if (to < 0 || to >= day.exercises.length) return
    const exs = day.exercises.slice()
    const [m] = exs.splice(from, 1)
    exs.splice(to, 0, m)
    update({ exercises: exs })
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <header className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">Day {dayNumber}</span>
        <input
          value={day.name}
          onChange={(e) => update({ name: e.target.value })}
          className="flex-1 bg-transparent border-b border-[color:var(--color-border)] focus:outline-none focus:border-[color:var(--color-accent)] px-1 py-1 text-base font-medium"
        />
        <label className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
          <input
            type="checkbox"
            checked={day.is_rest}
            onChange={(e) => update({ is_rest: e.target.checked })}
          />
          Rest
        </label>
        <button onClick={onMoveUp} className="min-h-[44px] min-w-[36px] text-[color:var(--color-muted)]" aria-label="Move day up">↑</button>
        <button onClick={onMoveDown} className="min-h-[44px] min-w-[36px] text-[color:var(--color-muted)]" aria-label="Move day down">↓</button>
      </header>

      {!day.is_rest && (
        <>
          <ul className="mt-3 space-y-2">
            {day.exercises.map((e, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 py-2"
              >
                <input
                  value={e.name}
                  onChange={(ev) => updateExercise(i, { name: ev.target.value })}
                  className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
                />
                <input
                  value={e.muscle_group}
                  onChange={(ev) => updateExercise(i, { muscle_group: ev.target.value })}
                  placeholder="Muscle"
                  className="w-24 bg-transparent text-xs text-[color:var(--color-muted)] focus:outline-none"
                />
                <select
                  value={e.type}
                  onChange={(ev) => updateExercise(i, { type: ev.target.value as 'compound' | 'isolation' })}
                  className="bg-transparent text-xs"
                >
                  <option value="compound">Compound</option>
                  <option value="isolation">Isolation</option>
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  value={e.default_sets}
                  onChange={(ev) =>
                    updateExercise(i, { default_sets: Math.max(1, Number(ev.target.value) || 1) })
                  }
                  className="w-12 bg-transparent text-xs text-center"
                  aria-label="Default sets"
                />
                <button
                  onClick={() => moveExercise(i, i - 1)}
                  className="text-[color:var(--color-muted)] min-h-[44px] w-7"
                  aria-label="Move exercise up"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveExercise(i, i + 1)}
                  className="text-[color:var(--color-muted)] min-h-[44px] w-7"
                  aria-label="Move exercise down"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeExercise(i)}
                  className="text-red-300 min-h-[44px] w-7"
                  aria-label="Remove exercise"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={addExercise}>+ Add exercise</Button>
          </div>
        </>
      )}
    </div>
  )
}
