import type { SessionSet } from '@/lib/supabase/database.types'

export type RestPerExercise = Map<string, { totalMs: number; count: number; avgMs: number }>

const isCounted = (s: SessionSet): boolean =>
  !s.is_warmup && !s.is_skipped && s.rest_ms != null && s.rest_ms > 0

export function totalRestMs(sets: SessionSet[]): number {
  let total = 0
  for (const s of sets) if (isCounted(s)) total += s.rest_ms as number
  return total
}

export function avgRestMs(sets: SessionSet[]): number {
  let total = 0
  let count = 0
  for (const s of sets) {
    if (!isCounted(s)) continue
    total += s.rest_ms as number
    count += 1
  }
  return count === 0 ? 0 : total / count
}

export function restByExercise(sets: SessionSet[]): RestPerExercise {
  const out: RestPerExercise = new Map()
  for (const s of sets) {
    if (!isCounted(s)) continue
    const prev = out.get(s.exercise_id)
    const totalMs = (prev?.totalMs ?? 0) + (s.rest_ms as number)
    const count = (prev?.count ?? 0) + 1
    out.set(s.exercise_id, { totalMs, count, avgMs: totalMs / count })
  }
  return out
}
