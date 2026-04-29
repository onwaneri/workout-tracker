import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { getClientUuid } from '@/lib/supabase/uuid'
import type { Goal } from '@/lib/supabase/database.types'
import { qk } from './keys'

async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase.from('goals').select('*')
  if (error) throw error
  return data ?? []
}

export const useGoals = () => useQuery({ queryKey: qk.goals(), queryFn: fetchGoals })

export const useUpsertExerciseGoal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { exercise_id: string; target_weight: number | null; target_reps: number | null }) => {
      const { data: existing } = await supabase.from('goals').select('*').eq('exercise_id', input.exercise_id).maybeSingle()
      if (existing) {
        const { data, error } = await supabase
          .from('goals')
          .update({ target_weight: input.target_weight, target_reps: input.target_reps })
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) throw error
        return data as Goal
      }
      const { data, error } = await supabase
        .from('goals')
        .insert({
          client_uuid: getClientUuid(),
          exercise_id: input.exercise_id,
          target_weight: input.target_weight,
          target_reps: input.target_reps,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as Goal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.goals() }),
  })
}

export const useUpsertVolumeGoal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { muscle_group: string; weekly_volume_target: number }) => {
      const { data: existing } = await supabase
        .from('goals')
        .select('*')
        .eq('muscle_group', input.muscle_group)
        .is('exercise_id', null)
        .maybeSingle()
      if (existing) {
        const { data, error } = await supabase
          .from('goals')
          .update({ weekly_volume_target: input.weekly_volume_target })
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) throw error
        return data as Goal
      }
      const { data, error } = await supabase
        .from('goals')
        .insert({
          client_uuid: getClientUuid(),
          muscle_group: input.muscle_group,
          weekly_volume_target: input.weekly_volume_target,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as Goal
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.goals() }),
  })
}
