import { supabase } from '@/lib/supabase/client'
import { getClientUuid } from '@/lib/supabase/uuid'

type DayDef =
  | { name: string; isRest: true }
  | {
      name: string
      isRest?: false
      exercises: Array<{ name: string; muscleGroup: string; type: 'compound' | 'isolation'; defaultSets?: number }>
    }

const UPPER: DayDef = {
  name: 'Upper',
  exercises: [
    { name: 'Incline Smith Machine Bench', muscleGroup: 'Chest / Front Delt', type: 'compound' },
    { name: 'Skullcrushers', muscleGroup: 'Triceps (long head)', type: 'isolation' },
    { name: 'Cable Pushdown', muscleGroup: 'Triceps (lateral/medial head)', type: 'isolation' },
    { name: 'Upright Row Machine', muscleGroup: 'Lateral Delt / Traps', type: 'compound' },
    { name: 'Pull-Ups', muscleGroup: 'Lats / Back', type: 'compound' },
    { name: 'Bicep Curl', muscleGroup: 'Biceps', type: 'isolation' },
    { name: 'Brachialis Curl', muscleGroup: 'Brachialis', type: 'isolation' },
    { name: 'Lateral Raise', muscleGroup: 'Lateral Delt', type: 'isolation' },
    { name: 'Rear Delt Fly', muscleGroup: 'Rear Delt', type: 'isolation' },
  ],
}

const DAYS: DayDef[] = [
  UPPER,
  {
    name: 'Lower — Quad-Focused',
    exercises: [
      { name: 'Leg Press', muscleGroup: 'Quads', type: 'compound' },
      { name: 'Bulgarian Split Squat', muscleGroup: 'Quads / Glutes', type: 'compound' },
      { name: 'Sumo RDL', muscleGroup: 'Hamstrings / Glutes', type: 'compound' },
      { name: 'Calf Raise', muscleGroup: 'Calves', type: 'isolation' },
    ],
  },
  { name: 'Rest', isRest: true },
  { ...UPPER, name: 'Upper' },
  {
    name: 'Lower — Posterior Chain',
    exercises: [
      { name: 'RDL', muscleGroup: 'Hamstrings', type: 'compound' },
      { name: 'Leg Curl', muscleGroup: 'Hamstrings', type: 'isolation' },
      { name: 'Cable Kickback', muscleGroup: 'Glutes', type: 'isolation' },
      { name: 'Adductor Machine', muscleGroup: 'Adductors', type: 'isolation' },
      { name: 'Calf Raise', muscleGroup: 'Calves', type: 'isolation' },
    ],
  },
  { name: 'Rest', isRest: true },
  { name: 'Rest', isRest: true },
]

export async function ensureDefaultPlan(): Promise<{ planId: string; planVersionId: string } | null> {
  const clientUuid = getClientUuid()

  const { data: existing, error: existingErr } = await supabase
    .from('plans')
    .select('id')
    .eq('client_uuid', clientUuid)
    .limit(1)
  if (existingErr) throw existingErr
  if (existing && existing.length > 0) {
    const planId = existing[0].id as string
    const { data: pv } = await supabase
      .from('plan_versions')
      .select('id')
      .eq('plan_id', planId)
      .eq('is_active', true)
      .limit(1)
    return { planId, planVersionId: (pv?.[0]?.id as string) ?? '' }
  }

  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .insert({ client_uuid: clientUuid, name: 'Upper / Lower' })
    .select('id')
    .single()
  if (planErr || !plan) throw planErr ?? new Error('plan insert failed')

  const { data: pv, error: pvErr } = await supabase
    .from('plan_versions')
    .insert({ plan_id: plan.id, client_uuid: clientUuid, version_number: 1, is_active: true })
    .select('id')
    .single()
  if (pvErr || !pv) throw pvErr ?? new Error('plan_version insert failed')

  for (let i = 0; i < DAYS.length; i++) {
    const def = DAYS[i]
    const { data: day, error: dayErr } = await supabase
      .from('workout_days')
      .insert({
        plan_version_id: pv.id,
        client_uuid: clientUuid,
        name: def.name,
        order_index: i,
        is_rest: def.isRest === true,
      })
      .select('id')
      .single()
    if (dayErr || !day) throw dayErr ?? new Error('workout_day insert failed')

    if (def.isRest) continue

    const exerciseRows = def.exercises.map((e, idx) => ({
      workout_day_id: day.id,
      client_uuid: clientUuid,
      name: e.name,
      muscle_group: e.muscleGroup,
      type: e.type,
      order_index: idx,
      default_sets: e.defaultSets ?? 2,
    }))
    const { data: exs, error: exErr } = await supabase.from('exercises').insert(exerciseRows).select('id, name')
    if (exErr || !exs) throw exErr ?? new Error('exercises insert failed')
  }

  return { planId: plan.id, planVersionId: pv.id }
}
