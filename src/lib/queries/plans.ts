import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Plan, PlanVersion, WorkoutDay } from '@/lib/supabase/database.types'
import { qk } from './keys'

async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('plans').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function fetchActivePlanVersion(): Promise<PlanVersion | null> {
  const { data, error } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function fetchWorkoutDays(planVersionId: string): Promise<WorkoutDay[]> {
  const { data, error } = await supabase
    .from('workout_days')
    .select('*')
    .eq('plan_version_id', planVersionId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const usePlans = () => useQuery({ queryKey: qk.plans(), queryFn: fetchPlans })

export const useActivePlanVersion = () =>
  useQuery({ queryKey: qk.activePlanVersion(), queryFn: fetchActivePlanVersion })

export const useWorkoutDays = (planVersionId: string | undefined) =>
  useQuery({
    queryKey: qk.workoutDays(planVersionId ?? ''),
    queryFn: () => fetchWorkoutDays(planVersionId!),
    enabled: !!planVersionId,
  })
