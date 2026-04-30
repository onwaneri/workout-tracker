import { supabase } from '@/lib/supabase/client'
import { getClientUuid } from '@/lib/supabase/uuid'
import type { Exercise, ExerciseType, WorkoutDay } from '@/lib/supabase/database.types'

export type EditedExercise = {
  id?: string
  prevExerciseId?: string | null
  name: string
  muscle_group: string
  type: ExerciseType
  default_sets: number
}

export type EditedDay = {
  id?: string
  name: string
  is_rest: boolean
  exercises: EditedExercise[]
}

export type EditedPlan = {
  planId: string
  prevPlanVersionId: string
  prevVersionNumber: number
  days: EditedDay[]
}

// Creates a new plan_version with the edits applied. Returns the new plan_version_id.
export async function snapshotPlan(edited: EditedPlan): Promise<string> {
  const clientUuid = getClientUuid()

  // 1) deactivate the prior version
  const { error: deactErr } = await supabase
    .from('plan_versions')
    .update({ is_active: false })
    .eq('id', edited.prevPlanVersionId)
  if (deactErr) throw deactErr

  // 2) create the new plan_version
  const { data: pv, error: pvErr } = await supabase
    .from('plan_versions')
    .insert({
      plan_id: edited.planId,
      client_uuid: clientUuid,
      version_number: edited.prevVersionNumber + 1,
      is_active: true,
    })
    .select('id')
    .single()
  if (pvErr || !pv) throw pvErr ?? new Error('plan_version create failed')
  const newPvId = pv.id

  // 3) create days and exercises
  for (let i = 0; i < edited.days.length; i++) {
    const d = edited.days[i]
    const { data: day, error: dErr } = await supabase
      .from('workout_days')
      .insert({
        plan_version_id: newPvId,
        client_uuid: clientUuid,
        name: d.name,
        order_index: i,
        is_rest: d.is_rest,
      })
      .select('id')
      .single()
    if (dErr || !day) throw dErr ?? new Error('day create failed')

    if (d.is_rest || d.exercises.length === 0) continue

    const exRows = d.exercises.map((e, idx) => ({
      workout_day_id: day.id,
      client_uuid: clientUuid,
      name: e.name,
      muscle_group: e.muscle_group,
      type: e.type,
      order_index: idx,
      default_sets: e.default_sets,
      previous_exercise_id: e.prevExerciseId ?? null,
    }))
    const { data: exs, error: exErr } = await supabase.from('exercises').insert(exRows).select('id')
    if (exErr || !exs) throw exErr ?? new Error('exercises create failed')
  }

  return newPvId
}

// Helper: build EditedPlan from current DB state to seed the editor form.
export function buildEditedPlanFromDb(
  planId: string,
  pvId: string,
  versionNumber: number,
  days: WorkoutDay[],
  exercisesByDay: Map<string, Exercise[]>,
): EditedPlan {
  return {
    planId,
    prevPlanVersionId: pvId,
    prevVersionNumber: versionNumber,
    days: [...days]
      .sort((a, b) => a.order_index - b.order_index)
      .map((d) => {
        const exs = (exercisesByDay.get(d.id) ?? []).slice().sort((a, b) => a.order_index - b.order_index)
        return {
          id: d.id,
          name: d.name,
          is_rest: d.is_rest,
          exercises: exs.map((e) => ({
            id: e.id,
            prevExerciseId: e.id, // when this day is saved, link back to the existing row
            name: e.name,
            muscle_group: e.muscle_group,
            type: e.type,
            default_sets: e.default_sets,
          })),
        }
      }),
  }
}
