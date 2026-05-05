import { useState } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { getClientUuid } from '@/lib/supabase/uuid'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function SettingsView() {
  const current = getClientUuid()
  const [pasted, setPasted] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <Screen title="Settings">
      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
        <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
          This device
        </div>
        <div className="mt-2 font-mono text-xs break-all select-all">{current}</div>
        <div className="mt-3">
          <Button variant="secondary" onClick={onCopy}>
            {copied ? 'Copied' : 'Copy UUID'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-[color:var(--color-muted)]">
          Each device gets its own ID. Two devices with the same ID see the same data.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
        <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
          Pair with another device
        </div>
        <p className="mt-2 text-xs text-[color:var(--color-muted)]">
          Paste the UUID from your other device. After pairing, this device will load that device’s
          workouts.
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
          className="mt-3 w-full font-mono text-xs bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-lg px-3 py-2 focus:outline-none"
        />
        {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
        <div className="mt-3">
          <Button variant="primary" onClick={onPair} disabled={pasted.trim() === ''}>
            Pair this device
          </Button>
        </div>
      </section>
    </Screen>
  )
}
