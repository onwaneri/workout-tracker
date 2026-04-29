import { useState } from 'react'
import { Button } from '@/components/Button'

export type SetDraft = {
  weight: string
  reps: string
  rpe: string
  isWarmup: boolean
  note: string
}

const empty: SetDraft = { weight: '', reps: '', rpe: '', isWarmup: false, note: '' }

export function SetRow({
  setNumber,
  onLog,
}: {
  setNumber: number
  onLog: (s: { weight: number | null; reps: number | null; rpe: number | null; isWarmup: boolean; note: string | null }) => void
}) {
  const [d, setD] = useState<SetDraft>(empty)
  const [showNote, setShowNote] = useState(false)

  const submit = () => {
    onLog({
      weight: d.weight === '' ? null : Number(d.weight),
      reps: d.reps === '' ? null : Number(d.reps),
      rpe: d.rpe === '' ? null : Number(d.rpe),
      isWarmup: d.isWarmup,
      note: d.note.trim() === '' ? null : d.note.trim(),
    })
    setD(empty)
    setShowNote(false)
  }

  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] w-8">#{setNumber}</span>
        <input
          inputMode="decimal"
          placeholder="Weight"
          value={d.weight}
          onChange={(e) => setD({ ...d, weight: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-base focus:outline-none"
        />
        <span className="text-[color:var(--color-muted)] text-sm">×</span>
        <input
          inputMode="numeric"
          placeholder="Reps"
          value={d.reps}
          onChange={(e) => setD({ ...d, reps: e.target.value })}
          className="w-16 bg-transparent text-base focus:outline-none"
        />
        <input
          inputMode="decimal"
          placeholder="RPE"
          value={d.rpe}
          onChange={(e) => setD({ ...d, rpe: e.target.value })}
          className="w-14 bg-transparent text-sm text-[color:var(--color-muted)] focus:outline-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
          <input
            type="checkbox"
            checked={d.isWarmup}
            onChange={(e) => setD({ ...d, isWarmup: e.target.checked })}
          />
          Warmup
        </label>
        <button
          className="text-xs text-[color:var(--color-muted)] underline"
          onClick={() => setShowNote((s) => !s)}
        >
          {showNote ? 'Hide note' : 'Add note'}
        </button>
        <Button variant="primary" onClick={submit}>
          Log set
        </Button>
      </div>
      {showNote && (
        <textarea
          value={d.note}
          onChange={(e) => setD({ ...d, note: e.target.value })}
          placeholder="Note"
          rows={2}
          className="mt-2 w-full text-sm bg-[color:var(--color-surface)] rounded-md px-2 py-1.5 focus:outline-none border border-[color:var(--color-border)]"
        />
      )}
    </div>
  )
}
