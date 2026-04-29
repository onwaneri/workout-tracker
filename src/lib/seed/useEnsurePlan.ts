import { useEffect, useState } from 'react'
import { ensureDefaultPlan } from './defaultPlan'

export type SeedState = { status: 'idle' | 'seeding' | 'ready' | 'error'; error?: string }

export function useEnsurePlan(): SeedState {
  const [state, setState] = useState<SeedState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'seeding' })
    ensureDefaultPlan()
      .then(() => {
        if (!cancelled) setState({ status: 'ready' })
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', error: err?.message ?? String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
