import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { getClientUuid } from '@/lib/supabase/uuid'
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

async function fetchAllWorkoutDays(): Promise<WorkoutDay[]> {
  const { data, error } = await supabase.from('workout_days').select('*')
  if (error) throw error
  return data ?? []
}

// Plan data changes infrequently (only on user edits). Use a longer stale time to reduce refetches.
export const usePlans = () =>
  useQuery({ queryKey: qk.plans(), queryFn: fetchPlans, staleTime: 5 * 60 * 1000 })

export const useActivePlanVersion = () =>
  useQuery({
    queryKey: qk.activePlanVersion(),
    queryFn: fetchActivePlanVersion,
    staleTime: 5 * 60 * 1000,
  })

export const useWorkoutDays = (planVersionId: string | undefined) =>
  useQuery({
    queryKey: qk.workoutDays(planVersionId ?? ''),
    queryFn: () => fetchWorkoutDays(planVersionId!),
    enabled: !!planVersionId,
    staleTime: 5 * 60 * 1000, // Workout days are static within a plan version.
  })

export const useAllWorkoutDays = () =>
  useQuery({
    queryKey: qk.workoutDaysAll(),
    queryFn: fetchAllWorkoutDays,
    staleTime: 5 * 60 * 1000,
  })

export const useSwitchActivePlan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (targetPlanId: string) => {
      const clientUuid = getClientUuid()
      const { error: deactErr } = await supabase
        .from('plan_versions')
        .update({ is_active: false })
        .eq('client_uuid', clientUuid)
        .eq('is_active', true)
      if (deactErr) throw deactErr
      const { data: pvs, error: pvErr } = await supabase
        .from('plan_versions')
        .select('*')
        .eq('plan_id', targetPlanId)
        .order('version_number', { ascending: false })
        .limit(1)
      if (pvErr) throw pvErr
      const pv = pvs?.[0]
      if (!pv) throw new Error('No version found for plan')
      const { error: actErr } = await supabase
        .from('plan_versions')
        .update({ is_active: true })
        .eq('id', pv.id)
      if (actErr) throw actErr
      return pv as PlanVersion
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      qc.invalidateQueries({ queryKey: ['plan-version'] })
      qc.invalidateQueries({ queryKey: ['workout-days'] })
      qc.invalidateQueries({ queryKey: ['exercises'] })
    },
  })
}

export const useCreatePlan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, dayCount }: { name: string; dayCount: number }) => {
      const clientUuid = getClientUuid()
      const { error: deactErr } = await supabase
        .from('plan_versions')
        .update({ is_active: false })
        .eq('client_uuid', clientUuid)
        .eq('is_active', true)
      if (deactErr) throw deactErr
      const { data: plan, error: planErr } = await supabase
        .from('plans')
        .insert({ client_uuid: clientUuid, name })
        .select('id')
        .single()
      if (planErr || !plan) throw planErr ?? new Error('plan insert failed')
      const { data: pv, error: pvErr } = await supabase
        .from('plan_versions')
        .insert({ plan_id: plan.id, client_uuid: clientUuid, version_number: 1, is_active: true })
        .select('id')
        .single()
      if (pvErr || !pv) throw pvErr ?? new Error('plan_version insert failed')
      const dayRows = Array.from({ length: dayCount }, (_, i) => ({
        plan_version_id: pv.id,
        client_uuid: clientUuid,
        name: `Day ${i + 1}`,
        order_index: i,
        is_rest: false,
      }))
      const { error: daysErr } = await supabase.from('workout_days').insert(dayRows)
      if (daysErr) throw daysErr
      return { planId: plan.id as string, planVersionId: pv.id as string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      qc.invalidateQueries({ queryKey: ['plan-version'] })
      qc.invalidateQueries({ queryKey: ['workout-days'] })
      qc.invalidateQueries({ queryKey: ['exercises'] })
    },
  })
}
