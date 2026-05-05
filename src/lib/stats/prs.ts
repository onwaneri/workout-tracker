import type { SessionSet } from '@/lib/supabase/database.types'

// Detect PRs in `sessionSets` against historical sets `prior` for the same exercise.
// Returns one entry per session set that is a new PR.
export type PRKind = 'weight' | 'reps-at-weight'
export type PRRecord = { setId: string; kind: PRKind; weight: number; reps: number }

export function detectPRs(sessionSets: SessionSet[], prior: SessionSet[]): PRRecord[] {
  const working = (s: SessionSet) => !s.is_warmup && !s.is_skipped && s.weight != null && s.reps != null
  const priorWorking = prior.filter(working)
  const priorMaxWeight = priorWorking.reduce((m, s) => Math.max(m, s.weight ?? 0), 0)
  // best reps at each weight
  const priorRepsByWeight = new Map<number, number>()
  for (const s of priorWorking) {
    if (s.weight == null || s.reps == null) continue
    priorRepsByWeight.set(s.weight, Math.max(priorRepsByWeight.get(s.weight) ?? 0, s.reps))
  }

  const result: PRRecord[] = []
  // Session sets are already ordered by logged_at in the query; no need to re-sort.
  // If they arrive out of order, the query is broken — sorting here masks that bug.
  const ordered = sessionSets.filter(working)
  let runningMaxWeight = priorMaxWeight
  // No need to copy priorRepsByWeight; it's local to this function and we can mutate it directly.
  const runningRepsByWeight = priorRepsByWeight

  for (const s of ordered) {
    if (s.weight == null || s.reps == null) continue
    if (s.weight > runningMaxWeight) {
      result.push({ setId: s.id, kind: 'weight', weight: s.weight, reps: s.reps })
      runningMaxWeight = s.weight
    }
    const bestReps = runningRepsByWeight.get(s.weight) ?? 0
    if (s.reps > bestReps) {
      // only flag rep PR if it isn't already a weight PR (avoid double-counting trivial cases)
      if (!result.some((r) => r.setId === s.id)) {
        result.push({ setId: s.id, kind: 'reps-at-weight', weight: s.weight, reps: s.reps })
      }
      runningRepsByWeight.set(s.weight, s.reps)
    }
  }
  return result
}
