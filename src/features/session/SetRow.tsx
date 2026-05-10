import { useEffect, useState } from 'react'

export type SetDraft = {
  weight: string
  reps: string
  rpe: string
  isWarmup: boolean
  note: string
}

export type SetPrefill = {
  weight: string
  reps: string
  rpe: string
}

const empty: SetDraft = { weight: '', reps: '', rpe: '', isWarmup: false, note: '' }

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

function step(val: string, delta: number, isDecimal = false): string {
  const n = parseFloat(val)
  const base = isNaN(n) ? 0 : n
  const next = Math.max(0, base + delta)
  return isDecimal ? String(Math.round(next * 2) / 2) : String(Math.round(next))
}

function NumberField({
  label,
  unit,
  value,
  prev,
  onChange,
  stepSmall,
  stepLarge,
  isDecimal,
}: {
  label: string
  unit?: string
  value: string
  prev?: string
  onChange: (v: string) => void
  stepSmall: number
  stepLarge: number
  isDecimal?: boolean
}) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 16,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
          {label}
        </span>
        {prev != null && prev !== '' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-faint)' }}>
            prev {prev}{unit ? unit : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <input
          inputMode={isDecimal ? 'decimal' : 'numeric'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 36,
            fontWeight: 500,
            color: 'var(--color-text)',
            letterSpacing: '-0.04em',
            fontFeatureSettings: '"tnum"',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            minWidth: 0,
          }}
        />
        {unit && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)' }}>{unit}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {[-stepLarge, -stepSmall, stepSmall, stepLarge].map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(step(value, d, isDecimal))}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
              minHeight: 32,
            }}
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SetRow({
  setNumber,
  prefill,
  bodyweight,
  onLog,
}: {
  setNumber: number
  prefill?: SetPrefill | null
  bodyweight?: number | null
  onLog: (s: { weight: number | null; reps: number | null; rpe: number | null; isWarmup: boolean; note: string | null }) => void
}) {
  const [d, setD] = useState<SetDraft>(() =>
    prefill
      ? { weight: prefill.weight, reps: prefill.reps, rpe: prefill.rpe, isWarmup: false, note: '' }
      : empty,
  )
  const [showNote, setShowNote] = useState(false)
  const [useBw, setUseBw] = useState<boolean>(() => bodyweight != null)

  useEffect(() => {
    if (!prefill) return
    setD((prev) => {
      if (prev.weight !== '' || prev.reps !== '' || prev.rpe !== '') return prev
      return { ...prev, weight: prefill.weight, reps: prefill.reps, rpe: prefill.rpe }
    })
  }, [prefill])

  const submit = () => {
    const bwActive = useBw && bodyweight != null
    onLog({
      weight: bwActive ? bodyweight! : d.weight === '' ? null : Number(d.weight),
      reps: d.reps === '' ? null : Number(d.reps),
      rpe: d.rpe === '' ? null : Number(d.rpe),
      isWarmup: d.isWarmup,
      note: d.note.trim() === '' ? null : d.note.trim(),
    })
    setD({ weight: bwActive ? '' : d.weight, reps: d.reps, rpe: d.rpe, isWarmup: false, note: '' })
    setShowNote(false)
  }

  const selectedRpe = d.rpe !== '' ? Number(d.rpe) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Number fields */}
      <div style={{ display: 'flex', gap: 12 }}>
        {bodyweight != null ? (
          <div style={{ flex: 1 }}>
            <button
              type="button"
              onClick={() => setUseBw((v) => !v)}
              style={{
                width: '100%', padding: '8px 14px', borderRadius: 10,
                border: `1px solid ${useBw ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: useBw ? 'var(--color-accent-soft)' : 'transparent',
                color: useBw ? 'var(--color-accent)' : 'var(--color-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
                marginBottom: 6,
              }}
            >
              {useBw ? `BW · ${bodyweight} lb` : 'Use bodyweight'}
            </button>
            {!useBw && (
              <NumberField label="Weight" unit="lb" value={d.weight} prev={prefill?.weight}
                onChange={(v) => setD({ ...d, weight: v })} stepSmall={2.5} stepLarge={5} isDecimal />
            )}
          </div>
        ) : (
          <NumberField label="Weight" unit="lb" value={d.weight} prev={prefill?.weight}
            onChange={(v) => setD({ ...d, weight: v })} stepSmall={2.5} stepLarge={5} isDecimal />
        )}
        <NumberField label="Reps" value={d.reps} prev={prefill?.reps}
          onChange={(v) => setD({ ...d, reps: v })} stepSmall={1} stepLarge={2} />
      </div>

      {/* RPE pills */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
            RPE · how hard?
          </div>
          {prefill?.rpe && prefill.rpe !== '' && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>
              last · {prefill.rpe}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {RPE_OPTIONS.map((v) => {
            const sel = selectedRpe === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setD({ ...d, rpe: sel ? '' : String(v) })}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: sel ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: sel ? 'var(--color-accent-ink)' : 'var(--color-text)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', fontFeatureSettings: '"tnum"', minHeight: 40,
                }}
              >
                {v}
              </button>
            )
          })}
        </div>
      </div>

      {/* Warmup + note row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-muted)', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={d.isWarmup}
            onChange={(e) => setD({ ...d, isWarmup: e.target.checked })}
            style={{ accentColor: 'var(--color-accent)' }}
          />
          Warmup
        </label>
        <button
          type="button"
          onClick={() => setShowNote((s) => !s)}
          style={{ fontSize: 12, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {showNote ? 'Hide note' : 'Add note'}
        </button>
      </div>

      {showNote && (
        <textarea
          value={d.note}
          onChange={(e) => setD({ ...d, note: e.target.value })}
          placeholder="Note"
          rows={2}
          style={{
            width: '100%', fontSize: 13, background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', borderRadius: 10,
            padding: '10px 12px', color: 'var(--color-text)', outline: 'none',
            fontFamily: 'var(--font-body)', boxSizing: 'border-box', resize: 'none',
          }}
        />
      )}

      {/* Log set CTA */}
      <button
        type="button"
        onClick={submit}
        style={{
          padding: 18, borderRadius: 18, border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-accent-ink)',
          fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', width: '100%',
        }}
      >
        <span>Log set {setNumber}{d.isWarmup ? ' (warmup)' : ''}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.7 }}>
          {d.weight || (useBw ? 'BW' : '?')} × {d.reps || '?'}
          {selectedRpe != null ? ` · RPE ${selectedRpe}` : ''}
        </span>
      </button>
    </div>
  )
}
