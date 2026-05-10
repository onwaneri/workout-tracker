import { useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { getClientUuid } from '@/lib/supabase/uuid'
import { PALETTES, usePalette, type PaletteKey } from '@/lib/theme'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Inline preview swatch for each palette
const PALETTE_PREVIEW: Record<PaletteKey, { bg: string; surface: string }> = {
  lime:    { bg: '#0d0c0a', surface: '#dffe60' },
  amber:   { bg: '#0d0c0a', surface: '#ffb444' },
  magenta: { bg: '#0d0c0a', surface: '#ff5fb0' },
  cyan:    { bg: '#0d0c0a', surface: '#79e8ff' },
  paper:   { bg: '#f6f3ed', surface: '#1a1814' },
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7.2 5.8 10 11 4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function SettingsView() {
  const current = getClientUuid()
  const [pasted, setPasted] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [palette, setPalette] = usePalette()

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(current)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  const onPair = () => {
    const next = pasted.trim().toLowerCase()
    if (!UUID_RE.test(next)) {
      setError('That does not look like a valid UUID.')
      return
    }
    if (next === current.toLowerCase()) {
      setError('That is already this device’s UUID.')
      return
    }
    if (
      !window.confirm(
        'Pair this device with the pasted UUID? This device will lose access to its current data unless you save the current UUID first.',
      )
    ) {
      return
    }
    localStorage.setItem('client_uuid', next)
    location.reload()
  }

  return (
    <Screen title="Account">

      {/* Theme picker */}
      <section style={{
        borderRadius: 18,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 14 }}>
          Accent &amp; theme
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PALETTES.map((p) => {
            const preview = PALETTE_PREVIEW[p.key]
            const isActive = palette === p.key
            return (
              <button
                key={p.key}
                onClick={() => setPalette(p.key)}
                style={{
                  position: 'relative',
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  border: isActive
                    ? '2px solid var(--color-text)'
                    : '1px solid var(--color-border)',
                  background: preview.bg,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  padding: 0,
                  boxShadow: isActive ? '0 0 0 1px var(--color-text)' : 'none',
                  transition: 'transform 0.12s',
                }}
                title={p.name}
                aria-label={`${p.name} theme${isActive ? ' (active)' : ''}`}
                aria-pressed={isActive}
              >
                {/* Accent color swatch — diagonal fill */}
                <div style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: '55%',
                  height: '55%',
                  background: preview.surface,
                  clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                }} />
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: preview.surface,
                  }}>
                    <CheckIcon />
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>
          {PALETTES.find((p) => p.key === palette)?.name}
          {PALETTES.find((p) => p.key === palette)?.light ? ' · light mode' : ' · dark mode'}
        </div>
      </section>

      {/* Device UUID */}
      <section style={{
        borderRadius: 18,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: 20,
        marginBottom: 20,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 10 }}>
          This device
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-all', userSelect: 'all', color: 'var(--color-text)' }}>
          {current}
        </div>
        <div style={{ marginTop: 14 }}>
          <Button variant="secondary" onClick={onCopy}>
            {copied ? 'Copied' : 'Copy UUID'}
          </Button>
        </div>
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
          Each device gets its own ID. Two devices with the same ID see the same data.
        </p>
      </section>

      {/* Pair another device */}
      <section style={{
        borderRadius: 18,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: 20,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 10 }}>
          Pair with another device
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 14 }}>
          Paste the UUID from your other device. After pairing, this device will load that device&apos;s workouts.
        </p>
        <input
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="00000000-0000-0000-0000-000000000000"
          value={pasted}
          onChange={(e) => {
            setPasted(e.target.value)
            setError(null)
          }}
          style={{
            width: '100%',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '10px 12px',
            color: 'var(--color-text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-danger)' }}>{error}</div>}
        <div style={{ marginTop: 14 }}>
          <Button variant="primary" onClick={onPair} disabled={pasted.trim() === ''}>
            Pair this device
          </Button>
        </div>
      </section>
    </Screen>
  )
}
