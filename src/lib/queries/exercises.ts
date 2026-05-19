import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Exercise } from '@/lib/supabase/database.types'
import { qk } from './keys'

async function fetchExercises(workoutDayId: string): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('workout_day_id', workoutDayId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function fetchAllExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const useExercises = (workoutDayId: string | undefined) =>
  useQuery({
    queryKey: qk.exercises(workoutDayId ?? ''),
    queryFn: () => fetchExercises(workoutDayId!),
    enabled: !!workoutDayId,
    staleTime: 5 * 60 * 1000, // Exercises are static within a workout day.
  })

export const useAllExercises = () =>
  useQuery({
    queryKey: qk.exercisesAll(),
    queryFn: fetchAllExercises,
    staleTime: 5 * 60 * 1000,
  })

// Returns the ID of the most recently created exercise whose name matches (case-insensitive, trimmed).
export function findMatchingExerciseId(name: string, all: Exercise[]): string | null {
  const norm = name.trim().toLowerCase()
  let best: Exercise | null = null
  for (const e of all) {
    if (e.name.trim().toLowerCase() === norm) {
      if (!best || e.created_at > best.created_at) best = e
    }
  }
  return best?.id ?? null
}

/**
 * Resolve all exercise IDs that share history with the given name.
 * Merges lineage chains AND orphaned exercises with the same name (case-insensitive).
 * This matches the grouping logic in HistoryView.
 */
export function resolveAllIdsForName(name: string, all: Exercise[]): string[] {
  const norm = name.trim().toLowerCase()
  const ids = new Set<string>()
  for (const e of all) {
    if (e.name.trim().toLowerCase() !== norm) continue
    for (const id of resolveExerciseLineage(e.id, all)) {
      ids.add(id)
    }
  }
  return Array.from(ids)
}

// Walks previous_exercise_id chain so renamed/reordered exercises share history.
// NOTE: This function rebuilds maps on every call. Ensure it's wrapped in useMemo at call sites.
export function resolveExerciseLineage(targetId: string, all: Exercise[]): string[] {
  const byId = new Map(all.map((e) => [e.id, e] as const))
  const byPrev = new Map<string, Exercise[]>()
  for (const e of all) {
    if (e.previous_exercise_id) {
      const list = byPrev.get(e.previous_exercise_id) ?? []
      list.push(e)
      byPrev.set(e.previous_exercise_id, list)
    }
  }
  const visited = new Set<string>()
  const stack = [targetId]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    const e = byId.get(id)
    if (e?.previous_exercise_id && !visited.has(e.previous_exercise_id)) stack.push(e.previous_exercise_id)
    const successors = byPrev.get(id) ?? []
    for (const s of successors) if (!visited.has(s.id)) stack.push(s.id)
  }
  return Array.from(visited)
}
