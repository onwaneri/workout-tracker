import type { Exercise, SessionSet } from '@/lib/supabase/database.types'

export type VolumeByMuscle = Map<string, number>

export const setVolume = (s: SessionSet): number => {
  if (s.is_warmup || s.is_skipped) return 0
  if (s.weight == null || s.reps == null) return 0
  return s.weight * s.reps
}

export function volumeByMuscleGroup(sets: SessionSet[], exercises: Exercise[]): VolumeByMuscle {
  const exById = new Map(exercises.map((e) => [e.id, e] as const))
  const out: VolumeByMuscle = new Map()
  for (const s of sets) {
    const v = setVolume(s)
    if (v === 0) continue
    const ex = exById.get(s.exercise_id)
    if (!ex) continue
    out.set(ex.muscle_group, (out.get(ex.muscle_group) ?? 0) + v)
  }
  return out
}

export function totalVolume(sets: SessionSet[]): number {
  let v = 0
  for (const s of sets) v += setVolume(s)
  return v
}
