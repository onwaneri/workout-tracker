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
  })

export const useAllExercises = () => useQuery({ queryKey: qk.exercisesAll(), queryFn: fetchAllExercises })

// Walks previous_exercise_id chain so renamed/reordered exercises share history.
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
